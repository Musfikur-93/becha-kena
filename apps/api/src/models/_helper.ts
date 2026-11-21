import mongoose, { type Document, type Model, type Schema } from 'mongoose';

export function getOrCreateModel<T extends Document>(name: string, schema: Schema<T>): Model<T> {
  return (mongoose.models[name] as Model<T> | undefined) ?? mongoose.model<T>(name, schema);
}
