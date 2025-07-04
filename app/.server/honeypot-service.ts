import { Honeypot } from "remix-utils/honeypot/server";

export const honeypot = new Honeypot({
  randomizeNameFieldName: false,
  nameFieldName: "name__confirm",
  validFromFieldName: "from__confirm", // null to disable it
  encryptionSeed: undefined, // Ideally it should be unique even between processes
});
