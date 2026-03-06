import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../../../data/database/config/postgres.config';

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface LoginDto {
  email?: string;
  username?: string;
  password: string;
  userOrEmail?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export class AuthService {
  private readonly JWT_SECRET = process.env.JWT_SECRET || 'default_secret_change_me';
  private readonly JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

  async login(credentials: LoginDto): Promise<AuthResponse> {
    const { password, userOrEmail, email, username } = credentials;

    // Determine what to search for
    const searchValue = userOrEmail || email || username;
    if (!searchValue) {
      throw new Error('Username or email is required');
    }

    // Check if it's an email or username
    const isEmail = searchValue.includes('@');
    const query = isEmail
      ? `SELECT id, email, password_hash, name, role, is_active, username
         FROM users
         WHERE email = $1`
      : `SELECT id, email, password_hash, name, role, is_active, username
         FROM users
         WHERE username = $1 OR email = $1`;

    const result = await pool.query(query, [searchValue]);

    if (result.rows.length === 0) {
      throw new Error('Usuário ou senha inválidos');
    }

    const user = result.rows[0];

    if (!user.is_active) {
      throw new Error('Conta desativada. Entre em contato com o administrador');
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      throw new Error('Usuário ou senha inválidos');
    }

    await pool.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    const userPayload: User = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    };

    const token = jwt.sign(userPayload, this.JWT_SECRET, {
      expiresIn: this.JWT_EXPIRES_IN
    });

    return {
      token,
      user: userPayload
    };
  }

  async verifyToken(token: string): Promise<User> {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET) as User;
      return decoded;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  async getUserById(id: string): Promise<User | null> {
    const query = `
      SELECT id, email, name, role
      FROM users
      WHERE id = $1 AND is_active = true
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0] as User;
  }
}

export const authService = new AuthService();