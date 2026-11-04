import { parseWithZod } from "@conform-to/zod/v4";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { buildSignupSchema } from "./build-schema";
import { DEFAULT_FORM } from "./default-form";

import { defaultText } from "~/features/site-text/text";
import {
  PersonSchema,
  SignupPersonSchema,
} from "~/utils/event-signup-validation";

const legacySchema = z
  .object({
    signupPerson: SignupPersonSchema,
    people: z
      .array(PersonSchema)
      .min(0, "You must at least sign up one person")
      .max(3, "You can't sign up more than 4 people"),
    comment: z.string().trim().optional(),
    acceptedPrivacy: z.boolean({
      error: "You must agree to signup",
    }),
  })
  .refine(
    (data) => {
      return data.acceptedPrivacy === true;
    },
    {
      message: "You must agree to register",
      path: ["acceptedPrivacy"],
    },
  );

const signupSchema = buildSignupSchema(DEFAULT_FORM, defaultText);

interface Person {
  name?: string;
  vegetarian?: boolean;
  student?: boolean;
  restrictions?: string;
}

interface Signup extends Person {
  email?: string;
  phone?: string;
  friends?: Person[];
  comment?: string;
  acceptedPrivacy?: boolean;
}

function appendPerson(
  formData: FormData,
  prefix: string,
  person: Person,
  keys: { vegetarian: string; restrictions: string },
) {
  if (person.name !== undefined) {
    formData.append(`${prefix}name`, person.name);
  }
  if (person.vegetarian) formData.append(`${prefix}${keys.vegetarian}`, "on");
  if (person.student) formData.append(`${prefix}student`, "on");
  if (person.restrictions !== undefined) {
    formData.append(`${prefix}${keys.restrictions}`, person.restrictions);
  }
}

function newFormData(signup: Signup): FormData {
  const formData = new FormData();
  const keys = { vegetarian: "vegetarian", restrictions: "restrictions" };

  appendPerson(formData, "", signup, keys);
  if (signup.email !== undefined) formData.append("email", signup.email);
  if (signup.phone !== undefined) formData.append("phone", signup.phone);
  (signup.friends ?? []).forEach((friend, index) => {
    appendPerson(formData, `friends[${index}].`, friend, keys);
  });
  if (signup.comment !== undefined) {
    formData.append("comment", signup.comment);
  }
  if (signup.acceptedPrivacy) formData.append("acceptedPrivacy", "on");

  return formData;
}

function legacyFormData(signup: Signup): FormData {
  const formData = new FormData();
  const keys = {
    vegetarian: "alternativeMenu",
    restrictions: "dietaryRestrictions",
  };

  appendPerson(formData, "signupPerson.", signup, keys);
  if (signup.email !== undefined) {
    formData.append("signupPerson.email", signup.email);
  }
  if (signup.phone !== undefined) {
    formData.append("signupPerson.phone", signup.phone);
  }
  (signup.friends ?? []).forEach((friend, index) => {
    appendPerson(formData, `people[${index}].`, friend, keys);
  });
  if (signup.comment !== undefined) {
    formData.append("comment", signup.comment);
  }
  if (signup.acceptedPrivacy) formData.append("acceptedPrivacy", "on");

  return formData;
}

function normalizePerson(
  person: Person,
): Required<Omit<Person, "restrictions">> & Pick<Person, "restrictions"> {
  return {
    name: person.name ?? "",
    vegetarian: person.vegetarian ?? false,
    student: person.student ?? false,
    restrictions: person.restrictions,
  };
}

function legacyPersonToNew(person: {
  name?: string;
  alternativeMenu?: boolean;
  student?: boolean;
  dietaryRestrictions?: string;
}): Person {
  return {
    name: person.name,
    vegetarian: person.alternativeMenu,
    student: person.student,
    restrictions: person.dietaryRestrictions,
  };
}

const validSignup: Signup = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  phone: "+41791234567",
  acceptedPrivacy: true,
};

const friend: Person = { name: "Charles Babbage", vegetarian: true };

describe("DEFAULT_FORM parity with the legacy signup schema", () => {
  it.each<[string, Signup]>([
    ["a minimal valid signup without friends", validSignup],
    [
      "a full valid signup",
      {
        ...validSignup,
        vegetarian: true,
        student: true,
        restrictions: "nuts",
        friends: [friend, { name: "Grace Hopper", restrictions: "gluten" }],
        comment: "Looking forward to it",
      },
    ],
    [
      "a signup at the friends limit",
      { ...validSignup, friends: [friend, friend, friend] },
    ],
    ["a missing name", { ...validSignup, name: undefined }],
    ["a missing email", { ...validSignup, email: undefined }],
    ["an invalid email", { ...validSignup, email: "not-an-email" }],
    ["a missing phone", { ...validSignup, phone: undefined }],
    [
      "an unaccepted privacy policy",
      { ...validSignup, acceptedPrivacy: false },
    ],
    [
      "a friend without a name",
      { ...validSignup, friends: [{ vegetarian: true }] },
    ],
    [
      "more friends than allowed",
      { ...validSignup, friends: [friend, friend, friend, friend] },
    ],
  ])("judges %s the same way", (_label, signup) => {
    const newResult = parseWithZod(newFormData(signup), {
      schema: signupSchema,
    });
    const legacyResult = parseWithZod(legacyFormData(signup), {
      schema: legacySchema,
    });

    expect(newResult.status).toBe(legacyResult.status);

    if (newResult.status !== "success" || legacyResult.status !== "success") {
      return;
    }

    const value = newResult.value as unknown as Signup & { friends: Person[] };
    const legacyValue = legacyResult.value;

    expect({
      ...normalizePerson(value),
      email: value.email,
      phone: value.phone,
      comment: value.comment,
      friends: value.friends.map(normalizePerson),
    }).toEqual({
      ...normalizePerson(legacyPersonToNew(legacyValue.signupPerson)),
      email: legacyValue.signupPerson.email,
      phone: legacyValue.signupPerson.phone,
      comment: legacyValue.comment,
      friends: legacyValue.people.map((person) =>
        normalizePerson(legacyPersonToNew(person)),
      ),
    });
  });

  describe("deliberate divergences from the legacy schema", () => {
    it("rejects a whitespace-only name that the legacy schema accepted as an empty name", () => {
      const signup: Signup = { ...validSignup, name: "   " };

      expect(
        parseWithZod(newFormData(signup), { schema: signupSchema }).status,
      ).toBe("error");
      expect(
        parseWithZod(legacyFormData(signup), { schema: legacySchema }).status,
      ).toBe("success");
    });

    it("accepts and trims a whitespace-padded email that the legacy schema rejected", () => {
      const signup: Signup = { ...validSignup, email: " ada@example.com " };

      const result = parseWithZod(newFormData(signup), {
        schema: signupSchema,
      });
      expect(result.status).toBe("success");
      if (result.status !== "success") throw new Error("unreachable");
      expect(result.value.email).toBe("ada@example.com");

      expect(
        parseWithZod(legacyFormData(signup), { schema: legacySchema }).status,
      ).toBe("error");
    });
  });

  it("produces the nested answer shape for a signup with friends", () => {
    const result = parseWithZod(
      newFormData({
        ...validSignup,
        friends: [friend],
        comment: "See you there",
      }),
      { schema: signupSchema },
    );

    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("unreachable");
    expect(result.value).toEqual({
      name: "Ada Lovelace",
      email: "ada@example.com",
      phone: "+41791234567",
      friends: [{ name: "Charles Babbage", vegetarian: true }],
      comment: "See you there",
      acceptedPrivacy: true,
    });
  });

  it("accepts a submission without any friends key", () => {
    const result = parseWithZod(newFormData(validSignup), {
      schema: signupSchema,
    });

    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("unreachable");
    expect(result.value.friends).toEqual([]);
  });

  it("keeps the legacy error messages for the identity and privacy fields", () => {
    const result = parseWithZod(newFormData({}), { schema: signupSchema });
    const legacyResult = parseWithZod(legacyFormData({}), {
      schema: legacySchema,
    });

    expect(result.status).toBe("error");
    if (result.status !== "error") throw new Error("unreachable");
    expect(legacyResult.status).toBe("error");
    if (legacyResult.status !== "error") throw new Error("unreachable");

    expect(result.error).toEqual({
      name: ["Name is required"],
      email: ["Email is required"],
      phone: ["Phone number is required"],
      acceptedPrivacy: ["You must agree to signup"],
    });
    expect(result.error?.["name"]).toEqual(
      legacyResult.error?.["signupPerson.name"],
    );
    expect(result.error?.["email"]).toEqual(
      legacyResult.error?.["signupPerson.email"],
    );
    expect(result.error?.["phone"]).toEqual(
      legacyResult.error?.["signupPerson.phone"],
    );
    expect(result.error?.["acceptedPrivacy"]).toEqual(
      legacyResult.error?.["acceptedPrivacy"],
    );
  });
});
