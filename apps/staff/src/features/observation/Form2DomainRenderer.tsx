import type { FormTwoDomain } from "./observationTypes";
import {
  CONFIDENCE_OPTIONS,
  FC_OPTIONS,
  SI_OPTIONS,
} from "./observationTypes";

export interface Form2ParameterValue {
  functionalCapacity?: string;
  supportIntensity?: string;
  confidence?: string;
  evidence?: string;
  immediateSupport?: string;
}

export type Form2DomainValues = Record<string, Form2ParameterValue>;

interface Form2DomainRendererProps {
  domain: FormTwoDomain;
  values: Form2DomainValues;
  onChange: (parameterId: string, value: Form2ParameterValue) => void;
}

function ScoreButton({
  value,
  selected,
  onClick,
}: {
  value: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`min-w-10 px-2.5 py-2 rounded-md border font-ui text-sm font-semibold transition-colors ${
        selected
          ? "bg-forest-500 border-forest-500 text-forest-950"
          : "bg-forest-950 border-forest-700 text-forest-200 hover:border-forest-500 hover:text-forest-100"
      }`}
    >
      {value}
    </button>
  );
}

function ScoreGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <p className="font-ui text-xs font-semibold text-forest-300 mb-2">
        {label}
      </p>

      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <ScoreButton
            key={option}
            value={option}
            selected={value === option}
            onClick={() => onChange(option)}
          />
        ))}
      </div>
    </div>
  );
}

export default function Form2DomainRenderer({
  domain,
  values,
  onChange,
}: Form2DomainRendererProps) {
  return (
    <div className="space-y-5">
      <div>
        <p className="font-ui text-xs uppercase tracking-wide text-forest-500 mb-1">
          Observation Domain
        </p>

        <h2 className="font-display text-xl text-forest-100">
          {domain.title}
        </h2>

        <p className="font-ui text-sm text-forest-300 mt-1">
          Score each parameter independently. Functional capacity describes
          what the learner can currently do. Support intensity describes the
          level of support required to access or sustain the function.
        </p>
      </div>

      <div className="space-y-4">
        {domain.parameters.map((parameter, index) => {
          const current = values[parameter.id] ?? {};

          return (
            <section
              key={parameter.id}
              className="bg-forest-900 border border-forest-800 rounded-lg p-4 space-y-4"
            >
              <div className="flex items-start gap-3">
                <span className="shrink-0 w-8 h-8 rounded-full bg-forest-700 text-forest-100 flex items-center justify-center font-ui text-xs font-semibold">
                  {index + 1}
                </span>

                <div>
                  <p className="font-ui text-xs text-forest-500">
                    {parameter.id}
                  </p>

                  <h3 className="font-ui text-sm font-semibold text-forest-100 mt-0.5">
                    {parameter.text}
                  </h3>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <ScoreGroup
                  label="Functional Capacity"
                  options={FC_OPTIONS}
                  value={current.functionalCapacity}
                  onChange={(value) =>
                    onChange(parameter.id, {
                      ...current,
                      functionalCapacity: value,
                    })
                  }
                />

                <ScoreGroup
                  label="Support Intensity"
                  options={SI_OPTIONS}
                  value={current.supportIntensity}
                  onChange={(value) =>
                    onChange(parameter.id, {
                      ...current,
                      supportIntensity: value,
                    })
                  }
                />

                <ScoreGroup
                  label="Confidence"
                  options={CONFIDENCE_OPTIONS}
                  value={current.confidence}
                  onChange={(value) =>
                    onChange(parameter.id, {
                      ...current,
                      confidence: value,
                    })
                  }
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block">
                  <span className="font-ui text-xs font-semibold text-forest-300">
                    Evidence observed
                  </span>

                  <textarea
                    value={current.evidence ?? ""}
                    onChange={(event) =>
                      onChange(parameter.id, {
                        ...current,
                        evidence: event.target.value,
                      })
                    }
                    rows={3}
                    placeholder="Record observable evidence, examples or context."
                    className="mt-2 w-full rounded-md border border-forest-700 bg-forest-950 px-3 py-2 font-ui text-sm text-forest-100 placeholder:text-forest-500 focus:outline-none focus:border-forest-500"
                  />
                </label>

                <label className="block">
                  <span className="font-ui text-xs font-semibold text-forest-300">
                    Immediate support needed
                  </span>

                  <textarea
                    value={current.immediateSupport ?? ""}
                    onChange={(event) =>
                      onChange(parameter.id, {
                        ...current,
                        immediateSupport: event.target.value,
                      })
                    }
                    rows={3}
                    placeholder="Record support that should be provided immediately, if any."
                    className="mt-2 w-full rounded-md border border-forest-700 bg-forest-950 px-3 py-2 font-ui text-sm text-forest-100 placeholder:text-forest-500 focus:outline-none focus:border-forest-500"
                  />
                </label>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
