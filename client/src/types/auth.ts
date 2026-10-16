
export type UserRole = "user" | "admin";

export type RegistrationRole = "user" ;

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  role: RegistrationRole;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  token: string;
  user: User;
}

export interface GetMeResponse {
  success: boolean;
  user: User;
}
