import { SimClient } from "./client";

/** One sim worker for the whole app; chrome controls and the render loop both need it. */
export const simClient = new SimClient();
