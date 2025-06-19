import type { Route } from "./+types/assistants";

export async function loader(_: Route.LoaderArgs) {
  try {
    return {
      success: true,
      data: [],
    };
  } catch (error) {
    console.error(error);
    return {
      success: false,
      error: "Something went wrong, please try again later.",
    };
  }
}

export async function action(_: Route.ActionArgs) {
  try {
    return {
      success: true,
      data: [],
    };
  } catch (error) {
    console.error(error);
    return {
      success: false,
      error: "Something went wrong, please try again later.",
    };
  }
}
