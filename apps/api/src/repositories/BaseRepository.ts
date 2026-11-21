import type {
  ClientSession,
  Document,
  FilterQuery,
  Model,
  ProjectionType,
  QueryOptions,
  Types,
  UpdateQuery
} from 'mongoose';

export class BaseRepository<T extends Document> {
  constructor(protected readonly model: Model<T>) {}

  async findById(
    id: string | Types.ObjectId,
    projection?: ProjectionType<T>,
    options?: QueryOptions<T>
  ): Promise<T | null> {
    return this.model.findById(id, projection, options).exec();
  }

  async findOne(
    filter: FilterQuery<T>,
    projection?: ProjectionType<T>,
    options?: QueryOptions<T>
  ): Promise<T | null> {
    return this.model.findOne(filter, projection, options).exec();
  }

  async find(
    filter: FilterQuery<T>,
    projection?: ProjectionType<T>,
    options?: QueryOptions<T>
  ): Promise<T[]> {
    return this.model.find(filter, projection, options).exec();
  }

  async create(doc: Partial<T>, session?: ClientSession): Promise<T> {
    if (session) {
      const [created] = await this.model.create([doc], { session });
      if (!created) {
        throw new Error(`Failed to create document in ${this.model.modelName}`);
      }
      return created;
    }
    return this.model.create(doc);
  }

  async updateById(
    id: string | Types.ObjectId,
    update: UpdateQuery<T>,
    session?: ClientSession
  ): Promise<T | null> {
    return this.model.findByIdAndUpdate(id, update, { new: true, session }).exec();
  }

  async count(filter: FilterQuery<T>): Promise<number> {
    return this.model.countDocuments(filter).exec();
  }
}
