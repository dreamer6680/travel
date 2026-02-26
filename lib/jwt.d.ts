// 临时类型声明，直到安装 @types/jsonwebtoken
declare module "jsonwebtoken" {
  export interface SignOptions {
    expiresIn?: string | number
    [key: string]: any
  }

  export interface JwtPayload {
    userId?: string
    email?: string
    role?: string
    [key: string]: any
  }

  export function sign(
    payload: object | string | Buffer,
    secretOrPrivateKey: string,
    options?: SignOptions
  ): string

  export function verify(
    token: string,
    secretOrPrivateKey: string
  ): JwtPayload | string

  export function decode(token: string): JwtPayload | null
}
