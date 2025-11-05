import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { UserEntity } from './user.entity';

@Entity('user_favorite_names')
@Index(['userId', 'name'], { unique: true })
export class UserFavoriteNameEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => UserEntity, (user) => user.favorites, {
    onDelete: 'CASCADE',
  })
  user: UserEntity;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  gender?: 'boy' | 'girl' | 'unisex';

  @Column({ type: 'varchar', length: 120, nullable: true })
  slug?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
