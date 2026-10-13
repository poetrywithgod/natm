// Form 1 field/domain types now live in @natm/shared-types so the staff app
// can render and export submissions with the same labels the family saw.
export {
  RATING_OPTIONS,
  IMPACT_OPTIONS,
  FREQUENCY_OPTIONS,
  NARRATIVE_FIELDS,
} from "@natm/shared-types";
export type {
  FieldType,
  CompoundSubField,
  FieldConfig,
  StepConfig,
  RatingValue,
  DomainType,
  RatingItem,
  SimpleItem,
  KeyValueField,
  Domain,
} from "@natm/shared-types";
