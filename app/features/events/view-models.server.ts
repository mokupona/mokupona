// The mappings from database rows to the view models in ./view-models. They
// render the event texts' Markdown, so they only run in loaders.

import type {
  EventCardModel,
  EventDetailModel,
  EventSummaryModel,
} from "./view-models";

import type { Address } from "~/models/address.server";
import type { EventWithImage } from "~/models/event.server";
import {
  markdownToText,
  renderMarkdown,
  renderOptionalMarkdown,
} from "~/shared/markdown.server";

type EventWithAddress = EventWithImage & { address: Address };
type EventWithAddressAndGalleryCount = EventWithAddress & {
  galleryImageCount: number;
};

function toEventSummaryModel(event: EventWithImage): EventSummaryModel {
  return {
    id: event.id,
    title: event.title,
    description: markdownToText(event.description),
    date: event.date,
    image: event.image,
    price: event.price,
    slots: event.slots,
    published: event.published,
  };
}

export function toEventCardModel(
  event: EventWithAddressAndGalleryCount,
): EventCardModel {
  return {
    ...toEventSummaryModel(event),
    addressLine: `${event.address.zip} ${event.address.city}`.toLowerCase(),
    galleryImageCount: event.galleryImageCount,
  };
}

export function toEventDetailModel(event: EventWithAddress): EventDetailModel {
  return {
    ...toEventSummaryModel(event),
    studentDiscount: event.studentDiscount,
    vegetarianDiscount: event.vegetarianDiscount,
    descriptionHtml: renderMarkdown(event.description),
    recapHtml: renderOptionalMarkdown(event.recap),
    menuHtml: renderOptionalMarkdown(event.menuDescription),
    donationHtml: renderOptionalMarkdown(event.donationDescription),
    discountsHtml: renderOptionalMarkdown(event.discounts),
    addressLine: `${event.address.zip} ${event.address.city}`,
  };
}
