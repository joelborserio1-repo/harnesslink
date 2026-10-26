// bcryptjs ships without types; we only use hash().
declare module 'bcryptjs' {
  const bcrypt: { hash(password: string, rounds: number): Promise<string> };
  export default bcrypt;
}
