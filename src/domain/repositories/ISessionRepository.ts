import { Session } from '../entities/Session';

export interface ISessionRepository {
  findById(id: string): Promise<Session | null>;
  findByAccessToken(token: string): Promise<Session | null>;
  findByRefreshToken(token: string): Promise<Session | null>;
  findByUserId(userId: string): Promise<Session[]>;
  save(session: Session): Promise<Session>;
  update(session: Session): Promise<Session>;
  delete(id: string): Promise<void>;
  deleteByUserId(userId: string): Promise<void>;
  deleteExpired(): Promise<void>;
  deleteInactive(inactivityThresholdMs: number): Promise<void>;
}
