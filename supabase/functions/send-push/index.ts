import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;

webpush.setVapidDetails(
  'mailto:support@ctrlbuild.dev',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: notifications, error: notifError } = await supabase
    .from('notifications')
    .select('id, recipient_id, title, body')
    .is('pushed_at', null)
    .limit(50);

  if (notifError) {
    return new Response(JSON.stringify({ error: notifError.message }), { status: 500 });
  }

  if (!notifications || notifications.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
  }

  let sentCount = 0;
  const processedIds: string[] = [];

  for (const notif of notifications) {
    const { data: subs, error: subError } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', notif.recipient_id);

    if (subError || !subs || subs.length === 0) {
      processedIds.push(notif.id);
      continue;
    }

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify({
            title: notif.title,
            body: notif.body || '',
            url: '/',
          })
        );
        sentCount++;
      } catch (err: any) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        } else {
          console.error('Push send failed for sub', sub.id, err.message);
        }
      }
    }

    processedIds.push(notif.id);
  }

  if (processedIds.length > 0) {
    await supabase
      .from('notifications')
      .update({ pushed_at: new Date().toISOString() })
      .in('id', processedIds);
  }

  return new Response(JSON.stringify({ sent: sentCount, processed: processedIds.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
