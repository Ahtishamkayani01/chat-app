import { configureStore } from "@reduxjs/toolkit";
import { chatApi } from "./api/chatApi";

// A function (not a single global store) so every browser tab / server request gets its own.
export const makeStore = () =>
  configureStore({
    reducer: {
      [chatApi.reducerPath]: chatApi.reducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(chatApi.middleware),
  });

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
