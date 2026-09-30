import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { toJsonSchema } from '@langchain/core/utils/json_schema';

// Gemini accepts only an OpenAPI subset of JSON Schema. Tool schemas from deepagents' built-in
// tools use more (type unions, exclusiveMinimum, ...), so reduce each schema to what Gemini takes.
const GEMINI_KEYS = new Set([
  'type', 'format', 'title', 'description', 'nullable', 'enum', 'default', 'example',
  'properties', 'required', 'items', 'anyOf', 'minItems', 'maxItems',
  'minLength', 'maxLength', 'pattern', 'minimum', 'maximum', 'minProperties', 'maxProperties',
]);

const geminiSafe = (schema) => {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return schema;
  const s = { ...schema };
  if (Array.isArray(s.type)) {
    const types = s.type.filter((t) => t !== 'null');
    if (types.length < s.type.length) s.nullable = true;
    s.type = types[0];
  }
  if (s.exclusiveMinimum !== undefined && s.minimum === undefined) s.minimum = s.exclusiveMinimum;
  if (s.exclusiveMaximum !== undefined && s.maximum === undefined) s.maximum = s.exclusiveMaximum;
  if (s.const !== undefined && s.enum === undefined) s.enum = [s.const];

  const out = {};
  for (const [k, v] of Object.entries(s)) {
    if (!GEMINI_KEYS.has(k)) continue;
    if (k === 'properties') out[k] = Object.fromEntries(Object.entries(v).map(([name, p]) => [name, geminiSafe(p)]));
    else if (k === 'items') out[k] = geminiSafe(v);
    else if (k === 'anyOf') out[k] = v.map(geminiSafe);
    else out[k] = v;
  }
  return out;
};

export default class GeminiChatModel extends ChatGoogleGenerativeAI {
  bindTools(tools, kwargs) {
    const declarations = tools.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: geminiSafe(toJsonSchema(t.schema)) },
    }));
    return super.bindTools(declarations, kwargs);
  }
}
