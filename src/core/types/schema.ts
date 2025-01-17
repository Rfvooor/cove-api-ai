// Schema type definitions
export type BasicSchemaType = 'string' | 'number' | 'boolean';
export type ComplexSchemaType = 'object' | 'array';
export type SchemaPropertyType = BasicSchemaType | ComplexSchemaType;

// Schema interfaces
export interface BaseSchemaProperty {
  type: SchemaPropertyType;
  description?: string;
  enum?: string[];
}

export interface ObjectProperty extends BaseSchemaProperty {
  type: 'object';
  properties: Record<string, SchemaProperty>;
  required?: string[];
}

export interface ArrayProperty extends BaseSchemaProperty {
  type: 'array';
  items: SchemaProperty;
}

export interface SimpleProperty extends BaseSchemaProperty {
  type: BasicSchemaType;
}

export type SchemaProperty = ObjectProperty | ArrayProperty | SimpleProperty;

export interface SchemaDefinition extends ObjectProperty {
  type: 'object';
  properties: Record<string, SchemaProperty>;
  required?: string[];
}