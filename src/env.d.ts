declare interface Env {
  readonly NG_APP_SPLITWISE_CLIENT_ID: string;
  readonly NG_APP_SPLITWISE_CLIENT_SECRET: string;
}

declare interface ImportMeta {
  readonly env: Env;
}
