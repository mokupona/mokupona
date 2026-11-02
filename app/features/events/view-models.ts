import type { Address } from "~/models/address.server";
import type { EventWithImage } from "~/models/event.server";
import type { ImageMetadata } from "~/models/image.server";

export type SerializableDate = Date | string;

export interface EventSummaryModel {
  id: string;
  title: string;
  description: string;
  date: SerializableDate;
  image: ImageMetadata | null;
  price: number;
  slots: number;
}

export interface EventCardModel extends EventSummaryModel {
  addressLine: string;
}

type EventWithAddress = EventWithImage & { address: Address };

function toEventSummaryModel(event: EventWithImage): EventSummaryModel {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    date: event.date,
    image: event.image,
    price: event.price,
    slots: event.slots,
  };
}

export function toEventCardModel(event: EventWithAddress): EventCardModel {
  return {
    ...toEventSummaryModel(event),
    addressLine: `${event.address.zip} ${event.address.city}`.toLowerCase(),
  };
}

export interface EventDetailModel extends EventSummaryModel {
  studentPrice: number | null;
  menuDescription: string | null;
  donationDescription: string | null;
  discounts: string | null;
  addressLine: string;
}

export function toEventDetailModel(event: EventWithAddress): EventDetailModel {
  return {
    ...toEventSummaryModel(event),
    studentPrice: event.studentPrice,
    menuDescription: event.menuDescription,
    donationDescription: event.donationDescription,
    discounts: event.discounts,
    addressLine: `${event.address.zip} ${event.address.city}`,
  };
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
