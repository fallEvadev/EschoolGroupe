export {};

declare global {
  /** Champs personnalisés du jeton de session Clerk (voir « Customize session token »). */
  interface CustomJwtSessionClaims {
    user_role?: string;
  }
}
