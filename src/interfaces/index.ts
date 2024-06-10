import { Request } from 'express';
export interface TokenResponse {
    token: string;
    userId: number;
  }

export interface User {
    id: number;
    email: string;
    name: string;
    validatePassword: (password: string) => boolean;
}

export interface UpdatePasswordRequestBody {
    email: string;
    password: string;
    newPassword: string;
  }
  
  // Define a type that includes the properties of `Request` and the custom `body`
export type UpdatePasswordRequest = Request & {
    body: UpdatePasswordRequestBody;
    error?: string;
    user?: any;
};
  

export interface SignUpRequest extends Request {
    body: {
      email: string;
      password: string;
    };
  }