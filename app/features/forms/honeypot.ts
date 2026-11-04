// Password managers autofill anything whose name looks like a person's name,
// which is why remix-utils' defaults (`name__confirm`/`from__confirm`) trip on
// real visitors. These names read as internal bookkeeping to a filler and to a
// human alike.
export const HONEYPOT_FIELD_NAME = "contact_ref";
export const HONEYPOT_VALID_FROM_FIELD_NAME = "contact_ref_from";
// the "please send it again" message is the site text site.forms.retry

export type HoneypotInputProps = { validFrom: string };
