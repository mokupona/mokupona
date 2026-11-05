import type { Address } from "~/models/address.server";
import type { ImageMetadata } from "~/models/image.server";

export type SerializableDate = Date | string;

export interface EventSummaryModel {
  id: string;
  title: string;
  /** plain text, the Markdown taken out: cards show it as a teaser */
  description: string;
  date: SerializableDate;
  image: ImageMetadata | null;
  price: number;
  slots: number;
  /** false for a draft, which only the admin area shows. */
  published: boolean;
}

export interface EventCardModel extends EventSummaryModel {
  addressLine: string;
  /** 0 means no gallery yet, so past-dinner cards fall back to the detail page. */
  galleryImageCount: number;
}

/**
 * The event page's texts come rendered from Markdown on the server
 * (view-models.server.ts), so the parser never ships to the browser. An
 * optional text that's missing or blank is null.
 */
export interface EventDetailModel extends EventSummaryModel {
  /** CHF off for students / vegetarians; null when there is none. Stackable. */
  studentDiscount: number | null;
  vegetarianDiscount: number | null;
  descriptionHtml: string;
  menuHtml: string | null;
  donationHtml: string | null;
  discountsHtml: string | null;
  addressLine: string;
}

export interface AddressOptionModel {
  label: string;
  value: string;
}

export function toAddressOptions(
  addresses: Array<
    Pick<Address, "id" | "streetName" | "houseNumber" | "zip" | "city">
  >,
): AddressOptionModel[] {
  return addresses.map((address) => ({
    label: `${address.streetName} ${address.houseNumber} - ${address.zip} ${address.city}`,
    value: address.id,
  }));
}
