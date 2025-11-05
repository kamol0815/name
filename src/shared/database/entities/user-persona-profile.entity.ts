import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';

export type TargetGender = 'boy' | 'girl' | 'unknown';

@Entity('user_persona_profiles')
@Index(['userId'], { unique: true })
export class UserPersonaProfileEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @OneToOne(() => UserEntity, (user) => user.personaProfile, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @Column({ type: 'date', nullable: true })
  expectedBirthDate?: Date;

  @Column({
    type: 'varchar',
    length: 16,
    default: 'unknown',
  })
  targetGender: TargetGender;

  @Column({ type: 'varchar', length: 120, nullable: true })
  familyName?: string;

  @Column({ type: 'varchar', array: true, nullable: true })
  parentNames?: string[];

  @Column({ type: 'varchar', array: true, nullable: true })
  focusValues?: string[];

  @Column({ type: 'varchar', length: 120, nullable: true })
  personaType?: string;

  @Column({ type: 'jsonb', nullable: true })
  quizAnswers?: Record<string, string>;

  @Column({ type: 'timestamp', nullable: true })
  lastPersonalizedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
