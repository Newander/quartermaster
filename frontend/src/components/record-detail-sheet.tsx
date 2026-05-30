import * as React from "react"
import {
  RiArchiveLine,
  RiCheckLine,
  RiCloseLine,
  RiEyeLine,
  RiEyeOffLine,
  RiLoader4Line,
  RiSaveLine,
} from "@remixicon/react"
import { toast } from "sonner"

import { DatePicker } from "@/components/date-picker"
import { ManyToManyRelationEditor } from "@/components/many-to-many-relation-editor"
import { MonthPicker } from "@/components/month-picker"
import { useIsMobile } from "@/hooks/use-mobile"
import { ApiValidationError } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import type {
  BackendApi,
  ModelMeta,
  RelationLookup,
  RelationLookups,
  SchemaField,
  SchemaFieldType,
} from "@/lib/backend-api"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

type DetailFieldType = SchemaFieldType | "json"
type LookupPrimitive = string | number
type RelationLookupValue = LookupPrimitive | LookupPrimitive[] | null
export type RelationLookupPayload = Record<string, RelationLookupValue>
export type CustomFormFieldMode = "create" | "edit"
export type CustomFormField = {
  name: string
  transcription: string
  description?: string
  data_type: SchemaFieldType
  value_type?: string
  ui_type?: string | null
  input_mode?: string
  semantic?: string | null
  nullable?: boolean
  default?: string | number | boolean | null
  allowed_values?: Array<string | number> | null
  modes?: CustomFormFieldMode[]
  required?: boolean
  writeOnly?: boolean
}

const EMPTY_CUSTOM_FIELDS: CustomFormField[] = []

type RecordDetailSheetProps<TRecord extends Record<string, unknown>> = {
  api: BackendApi
  schemaRoute: string
  baseRoute: string
  recordId?: number | null
  isOpen?: boolean
  mode?: "edit" | "create"
  entityLabel: string
  readOnlyFields?: string[]
  onClose: () => void
  loadRecord?: (id: number) => Promise<TRecord>
  updateRecord?: (
    id: number,
    payload: Record<string, unknown>
  ) => Promise<TRecord>
  createRecord?: (payload: Record<string, unknown>) => Promise<TRecord>
  onCreated?: (record: TRecord) => void | Promise<void>
  syncRelations?: (
    recordId: number,
    relations: RelationLookupPayload
  ) => void | Promise<void>
  onArchive?: (record: TRecord | null) => void | Promise<void>
  getRecordTitle?: (record: TRecord | null, recordId: number) => string
  schemaOverride?: ModelMeta
  customFields?: CustomFormField[]
}

const COMPLEX_FIELD_TYPES = new Set<DetailFieldType>([
  "dict",
  "list",
  "bytes",
  "Any",
  "json",
])
const CREATE_HIDDEN_FIELD_NAMES = new Set([
  "created_at",
  "updated_at",
  "deleted_at",
])
const FIELD_TYPE_LABELS: Record<string, string> = {
  date: "data",
  float: "liczba zmiennoprzecinkowa",
  datetime: "data i czas",
  int: "liczba całkowita",
  str: "tekst",
  bool: "wartość logiczna",
  PaymentStatus: "status płatności",
  MembershipType: "typ członkostwa",
  PaymentMethod: "metoda płatności",
  DayOfWeek: "dzień tygodnia",
  ScheduleCycle: "cykl harmonogramu",
  time: "czas",
  Decimal: "liczba dziesiętna",
  dict: "obiekt JSON",
  list: "lista",
  bytes: "bajty",
  UUID: "identyfikator UUID",
  timedelta: "przedział czasu",
  Any: "dowolna wartość",
}

const getFieldTypeLabel = (type: string) => FIELD_TYPE_LABELS[type] ?? type

const isRecordObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

const toRecordArray = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter(isRecordObject) : []

const extractLookupItems = (payload: unknown): Record<string, unknown>[] => {
  if (Array.isArray(payload)) {
    return toRecordArray(payload)
  }

  if (!isRecordObject(payload)) {
    return []
  }

  for (const key of ["records", "items", "results", "data"]) {
    const candidate = payload[key]
    if (Array.isArray(candidate)) {
      return toRecordArray(candidate)
    }
  }

  const firstArrayEntry = Object.values(payload).find((value) =>
    Array.isArray(value)
  )
  if (Array.isArray(firstArrayEntry)) {
    return toRecordArray(firstArrayEntry)
  }

  return []
}

const createLookupFieldMap = (lookups: RelationLookups) => {
  const mappedLookups: Record<string, RelationLookup> = {}

  for (const [lookupName, lookup] of Object.entries(lookups)) {
    if (!(lookupName in mappedLookups)) {
      mappedLookups[lookupName] = lookup
    }

    if (lookup.foreign_key && !(lookup.foreign_key in mappedLookups)) {
      mappedLookups[lookup.foreign_key] = lookup
    }
  }

  return mappedLookups
}

const toLookupPrimitive = (value: unknown, valueField: string) => {
  if (typeof value === "string" || typeof value === "number") {
    return value
  }

  if (isRecordObject(value)) {
    const nestedValue = value[valueField]
    if (typeof nestedValue === "string" || typeof nestedValue === "number") {
      return nestedValue
    }
  }

  return null
}

const normalizeLookupPrimitive = (value: unknown): LookupPrimitive | null => {
  if (typeof value === "string" || typeof value === "number") {
    return value
  }
  return null
}

const getSelectedLookupValues = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeLookupPrimitive(item))
      .filter((item): item is LookupPrimitive => item !== null)
      .map(String)
  }

  const normalized = normalizeLookupPrimitive(value)
  return normalized === null ? [] : [String(normalized)]
}

const buildLookupOptionMap = (
  options: Record<string, unknown>[],
  valueField: string
) => {
  const mappedOptions = new Map<string, LookupPrimitive>()

  for (const option of options) {
    const rawValue = normalizeLookupPrimitive(option[valueField])
    if (rawValue === null) {
      continue
    }
    mappedOptions.set(String(rawValue), rawValue)
  }

  return mappedOptions
}

const prettifyFieldName = (fieldName: string): string =>
  fieldName.replaceAll("_", " ").replace(/\s+/g, " ").trim()

const getLookupDescription = (lookup: RelationLookup): string | null => {
  if (typeof lookup.description === "string" && lookup.description.trim()) {
    return lookup.description.trim()
  }

  const rawLookup = lookup as Record<string, unknown>
  for (const key of [
    "help_text",
    "hint",
    "ui_description",
    "description_text",
  ]) {
    const rawValue = rawLookup[key]
    if (typeof rawValue === "string" && rawValue.trim()) {
      return rawValue.trim()
    }
  }

  return null
}

const getLookupTranscription = (
  lookup: RelationLookup,
  fallbackFieldName: string
): string => {
  if (typeof lookup.transcription === "string" && lookup.transcription.trim()) {
    return lookup.transcription.trim()
  }

  if (
    typeof lookup.foreign_table === "string" &&
    lookup.foreign_table.trim().length > 0
  ) {
    return prettifyFieldName(lookup.foreign_table)
  }

  return prettifyFieldName(fallbackFieldName)
}

const getLookupForeignTable = (lookup: RelationLookup): string | null => {
  if (
    typeof lookup.foreign_table === "string" &&
    lookup.foreign_table.trim().length > 0
  ) {
    return lookup.foreign_table.trim()
  }

  return null
}

const getLookupSourceValueField = (lookup: RelationLookup): string =>
  lookup.source_value_field?.trim() || lookup.value_field

const normalizeLookupValue = (value: unknown, lookup: RelationLookup) => {
  const valueField = getLookupSourceValueField(lookup)

  if (lookup.relation_kind === "many") {
    if (!Array.isArray(value)) {
      return []
    }

    return value
      .map((entry) => toLookupPrimitive(entry, valueField))
      .filter((entry): entry is string | number => entry !== null)
  }

  return toLookupPrimitive(value, valueField)
}

function RelationSelect({
  api,
  id,
  lookup,
  value,
  resetKey,
  onChange,
  disabled,
  nullable,
}: {
  api: BackendApi
  id: string
  lookup: RelationLookup
  value: unknown
  resetKey?: string | number
  onChange: (value: RelationLookupValue) => void
  disabled?: boolean
  nullable?: boolean
}) {
  const [options, setOptions] = React.useState<Record<string, unknown>[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const requestedMissingValuesRef = React.useRef<Set<string>>(new Set())
  const isMulti = lookup.relation_kind === "many"
  const valueField = lookup.value_field
  const sourceValueField = getLookupSourceValueField(lookup)
  const labelField = lookup.label_field
  const selectedValues = React.useMemo(
    () => getSelectedLookupValues(value),
    [value]
  )
  const optionValueMap = React.useMemo(
    () => buildLookupOptionMap(options, valueField),
    [options, valueField]
  )
  const selectedPrimitiveMap = React.useMemo(() => {
    const mappedValues = new Map<string, LookupPrimitive>()

    if (Array.isArray(value)) {
      for (const entry of value) {
        const primitive = toLookupPrimitive(entry, sourceValueField)
        if (primitive === null) {
          continue
        }
        mappedValues.set(String(primitive), primitive)
      }
      return mappedValues
    }

    const singleValue =
      toLookupPrimitive(value, sourceValueField) ??
      normalizeLookupPrimitive(value)
    if (singleValue !== null) {
      mappedValues.set(String(singleValue), singleValue)
    }

    return mappedValues
  }, [sourceValueField, value])
  const relationOptions = React.useMemo(() => {
    const mappedOptions = new Map<
      string,
      { value: LookupPrimitive; label: string }
    >()

    for (const option of options) {
      const primitive = normalizeLookupPrimitive(option[valueField])
      if (primitive === null) {
        continue
      }
      const normalizedValue = String(primitive)
      if (mappedOptions.has(normalizedValue)) {
        continue
      }
      mappedOptions.set(normalizedValue, {
        value: primitive,
        label: String(option[labelField] ?? option[valueField] ?? primitive),
      })
    }

    return Array.from(mappedOptions.values())
  }, [labelField, options, valueField])

  React.useEffect(() => {
    let isCancelled = false
    const loadOptions = async () => {
      setIsLoading(true)
      try {
        const data = await api.client.get<unknown>(lookup.api_route)
        if (isCancelled) {
          return
        }

        setOptions(extractLookupItems(data))
      } catch (err) {
        console.error(
          "Failed to load options for lookup",
          lookup.api_route,
          err
        )
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }
    void loadOptions()
    return () => {
      isCancelled = true
    }
  }, [api, lookup.api_route])

  React.useEffect(() => {
    const missingValues = selectedValues.filter(
      (item) =>
        !optionValueMap.has(item) &&
        !requestedMissingValuesRef.current.has(item)
    )

    if (missingValues.length === 0) {
      return
    }

    for (const missingValue of missingValues) {
      requestedMissingValuesRef.current.add(missingValue)
    }

    let isCancelled = false

    const loadMissingOptions = async () => {
      const fetchedOptions = await Promise.all(
        missingValues.map(async (missingValue) => {
          try {
            const selectedItem = await api.client.get<unknown>(
              `${lookup.api_route}/${missingValue}`
            )
            return isRecordObject(selectedItem) ? selectedItem : null
          } catch {
            return null
          }
        })
      )

      if (isCancelled) {
        return
      }

      const validOptions = fetchedOptions.filter(
        (item): item is Record<string, unknown> => item !== null
      )

      if (validOptions.length === 0) {
        return
      }

      setOptions((current) => {
        const knownValues = new Set(
          current
            .map((item) => normalizeLookupPrimitive(item[valueField]))
            .filter((item): item is LookupPrimitive => item !== null)
            .map(String)
        )

        const nextOptions = [...current]
        for (const option of validOptions) {
          const rawValue = normalizeLookupPrimitive(option[valueField])
          if (rawValue === null) {
            continue
          }
          const normalizedValue = String(rawValue)
          if (knownValues.has(normalizedValue)) {
            continue
          }
          knownValues.add(normalizedValue)
          nextOptions.unshift(option)
        }

        return nextOptions
      })
    }

    void loadMissingOptions()

    return () => {
      isCancelled = true
    }
  }, [api, lookup.api_route, optionValueMap, selectedValues, valueField])

  if (isMulti) {
    return (
      <ManyToManyRelationEditor
        id={id}
        options={relationOptions}
        selectedValues={selectedValues}
        analysisKey={resetKey ?? id}
        isLoading={isLoading}
        disabled={disabled}
        onChange={(nextSelectedValues) => {
          onChange(
            nextSelectedValues.map(
              (selectedValue) =>
                optionValueMap.get(selectedValue) ??
                selectedPrimitiveMap.get(selectedValue) ??
                selectedValue
            )
          )
        }}
      />
    )
  }

  return (
    <Select
      disabled={disabled || isLoading}
      value={
        value === null
          ? "__null"
          : value === undefined || value === ""
            ? undefined
            : String(value)
      }
      onValueChange={(nextValue) => {
        if (nextValue === "__null") {
          onChange(null)
          return
        }

        onChange(optionValueMap.get(nextValue) ?? nextValue)
      }}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue
          placeholder={isLoading ? "Ładowanie..." : "Wybierz wartość"}
        />
      </SelectTrigger>
      <SelectContent align="start">
        {nullable ? (
          <SelectItem value="__null">Brak wartości</SelectItem>
        ) : null}
        {options.map((opt) => (
          <SelectItem
            key={String(opt[valueField])}
            value={String(opt[valueField])}
          >
            {String(opt[labelField] ?? opt[valueField])}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

type ResolvedFieldDefinition = {
  allowedValues: Array<string | number>
  description: string
  fieldMetaDescription: string
  isVirtualLookup?: boolean
  name: string
  nullable: boolean
  required: boolean
  transcription: string
  data_type: DetailFieldType
  ui_type?: string | null
  writeOnly?: boolean
}

type FieldGroup = {
  key: "main" | "relations" | "many-relations" | "system"
  title: string
  description: string
  fields: ResolvedFieldDefinition[]
}

const normalizeDateTimeLocalValue = (value: string) => {
  const parsedDate = new Date(value)

  if (!Number.isNaN(parsedDate.getTime())) {
    return parsedDate.toISOString().slice(0, 16)
  }

  return value.slice(0, 16)
}

const normalizeInputValue = (value: unknown, type: DetailFieldType) => {
  if (value === null || value === undefined) {
    return ""
  }

  if (COMPLEX_FIELD_TYPES.has(type)) {
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }

  if (type === "datetime" && typeof value === "string") {
    return normalizeDateTimeLocalValue(value)
  }

  if (type === "date" && typeof value === "string") {
    return value.slice(0, 10)
  }

  if (type === "time" && typeof value === "string") {
    return value.slice(0, 8)
  }

  return String(value)
}

const inferFieldType = (value: unknown): DetailFieldType => {
  if (Array.isArray(value) || (typeof value === "object" && value !== null)) {
    return "json"
  }

  if (typeof value === "boolean") {
    return "bool"
  }

  if (typeof value === "number") {
    return Number.isInteger(value) ? "int" : "float"
  }

  return "str"
}

const resolveFieldType = (
  field: SchemaField | undefined,
  value: unknown
): DetailFieldType => {
  if (!field) {
    return inferFieldType(value)
  }

  return COMPLEX_FIELD_TYPES.has(field.data_type) ? "json" : field.data_type
}

const getFieldTranscription = (
  field: SchemaField | undefined,
  fieldName: string
) => field?.transcription?.trim() || prettifyFieldName(fieldName)

const getFieldDescription = (
  field: SchemaField | undefined,
  fieldName: string
) => field?.description?.trim() || getFieldTranscription(field, fieldName)

const getFieldMetaDescription = (
  field: SchemaField | undefined,
  fieldName: string,
  isReadOnly: boolean
) => {
  const metaParts = [`Typ: ${getFieldTypeLabel(field?.data_type ?? "str")}`]

  if (!field?.description || field.description.trim() !== fieldName) {
    metaParts.unshift(`Pole: ${fieldName}`)
  }

  if (field?.foreign_keys && field.foreign_keys.length > 0) {
    const [firstForeignKey] = field.foreign_keys
    metaParts.push(
      `FK: ${firstForeignKey.target_table}.${firstForeignKey.target_field}`
    )
  }

  if (isReadOnly) {
    metaParts.push("tylko odczyt")
  }

  return metaParts.join(" · ")
}

const isEditableCreateField = (
  field: SchemaField,
  readOnlyFieldSet: Set<string>
) =>
  !readOnlyFieldSet.has(field.name) &&
  !field.primary_key &&
  !CREATE_HIDDEN_FIELD_NAMES.has(field.name)

const resolveInitialFieldValue = (field: SchemaField) => {
  if (
    field.default !== null &&
    field.default !== undefined &&
    !(
      typeof field.default === "string" &&
      (field.default.startsWith("<callable:") || field.default.includes("("))
    )
  ) {
    return field.default
  }

  if (field.nullable) {
    return null
  }

  if (field.data_type === "bool") {
    return false
  }

  return ""
}

const isCustomFieldEnabledForMode = (
  field: CustomFormField,
  mode: CustomFormFieldMode
) => !field.modes || field.modes.includes(mode)

const customFieldToSchemaField = (field: CustomFormField): SchemaField => ({
  name: field.name,
  transcription: field.transcription,
  description: field.description ?? field.transcription,
  data_type: field.data_type,
  value_type: field.value_type ?? field.data_type,
  ui_type: field.ui_type ?? "text",
  input_mode: field.writeOnly ? "write_only" : (field.input_mode ?? "manual"),
  semantic: field.semantic ?? null,
  nullable: field.nullable ?? !field.required,
  primary_key: false,
  default: field.default ?? null,
  foreign_keys: [],
  allowed_values: field.allowed_values ?? null,
  rules: field.required ? { required: true } : null,
  derive: null,
})

const mergeSchemaFields = (
  schemaFields: SchemaField[],
  customSchemaFields: SchemaField[]
) => {
  const mergedFields = new Map<string, SchemaField>()

  for (const field of schemaFields) {
    mergedFields.set(field.name, field)
  }

  for (const field of customSchemaFields) {
    mergedFields.set(field.name, field)
  }

  return Array.from(mergedFields.values())
}

const buildInitialCreateValues = (
  schemaFields: SchemaField[],
  readOnlyFieldSet: Set<string>
) =>
  schemaFields.reduce<Record<string, unknown>>((accumulator, field) => {
    if (!isEditableCreateField(field, readOnlyFieldSet)) {
      return accumulator
    }

    accumulator[field.name] = resolveInitialFieldValue(field)
    return accumulator
  }, {})

const getVirtualLookupFieldNames = (
  relationLookups: RelationLookups,
  schemaFieldsByName: Map<string, SchemaField>
) => {
  const virtualFieldNames: string[] = []
  const usedCanonicalKeys = new Set<string>()

  for (const [lookupName, lookup] of Object.entries(relationLookups)) {
    if (schemaFieldsByName.has(lookupName)) {
      continue
    }

    const canonicalKey = lookup.foreign_key ?? lookupName
    if (
      schemaFieldsByName.has(canonicalKey) ||
      usedCanonicalKeys.has(canonicalKey)
    ) {
      continue
    }

    usedCanonicalKeys.add(canonicalKey)
    virtualFieldNames.push(lookupName)
  }

  return virtualFieldNames
}

const normalizeRecordFormValues = (
  loadedRecordData: Record<string, unknown>,
  schemaFields: SchemaField[],
  schemaLookups: RelationLookups,
  fallbackValues?: Record<string, unknown>
) => {
  const normalizedValues: Record<string, unknown> = { ...loadedRecordData }
  const schemaFieldNameSet = new Set(schemaFields.map((field) => field.name))
  const lookupMap = createLookupFieldMap(schemaLookups)

  for (const [fieldName, lookup] of Object.entries(lookupMap)) {
    if (!(fieldName in normalizedValues)) {
      continue
    }
    normalizedValues[fieldName] = normalizeLookupValue(
      normalizedValues[fieldName],
      lookup
    )
  }

  for (const [lookupName, lookup] of Object.entries(schemaLookups)) {
    if (schemaFieldNameSet.has(lookupName)) {
      continue
    }

    if (lookupName in loadedRecordData) {
      normalizedValues[lookupName] = normalizeLookupValue(
        loadedRecordData[lookupName],
        lookup
      )
      continue
    }

    if (fallbackValues && lookupName in fallbackValues) {
      normalizedValues[lookupName] = fallbackValues[lookupName]
      continue
    }

    normalizedValues[lookupName] = lookup.relation_kind === "many" ? [] : null
  }

  return normalizedValues
}

const buildFieldDefinitions = (
  fieldNames: string[],
  schemaFields: SchemaField[],
  formValues: Record<string, unknown>,
  readOnlyFieldSet: Set<string>,
  lookupByFieldName: Record<string, RelationLookup> = {}
): ResolvedFieldDefinition[] => {
  const schemaFieldsByName = new Map(
    schemaFields.map((field) => [field.name, field])
  )

  return fieldNames.map((fieldName) => {
    const schemaField = schemaFieldsByName.get(fieldName)
    const lookup = lookupByFieldName[fieldName]
    const lookupDescription = lookup ? getLookupDescription(lookup) : null
    const lookupForeignTable = lookup ? getLookupForeignTable(lookup) : null

    if (!schemaField && lookup) {
      const relationLabel =
        lookup.relation_kind === "many" ? "Relacja N-M / 1-N" : "Relacja 1-1"
      const relationMetaParts = [relationLabel]
      const lookupTranscription = getLookupTranscription(lookup, fieldName)
      if (lookupForeignTable) {
        relationMetaParts.push(`FK: ${lookupForeignTable}`)
      }
      relationMetaParts.push(lookupDescription ?? "pole zależne (drugi krok)")

      return {
        allowedValues: [],
        description: lookupDescription ?? lookupTranscription,
        fieldMetaDescription: relationMetaParts.join(" · "),
        isVirtualLookup: true,
        name: fieldName,
        nullable: true,
        required: false,
        transcription: lookupTranscription,
        data_type: lookup.relation_kind === "many" ? "json" : "int",
        ui_type: null,
      }
    }

    const fieldType = resolveFieldType(schemaField, formValues[fieldName])
    const fieldMetaBase = getFieldMetaDescription(
      schemaField,
      fieldName,
      readOnlyFieldSet.has(fieldName)
    )
    const fieldMetaParts = [fieldMetaBase]
    if (lookupForeignTable) {
      fieldMetaParts.push(`FK: ${lookupForeignTable}`)
    }
    if (lookupDescription) {
      fieldMetaParts.unshift(lookupDescription)
    }

    return {
      allowedValues: schemaField?.allowed_values ?? [],
      description: getFieldDescription(schemaField, fieldName),
      fieldMetaDescription: fieldMetaParts.join(" · "),
      isVirtualLookup: false,
      name: fieldName,
      nullable: schemaField?.nullable ?? true,
      required: Boolean(schemaField?.rules?.required),
      transcription: getFieldTranscription(schemaField, fieldName),
      data_type: fieldType,
      ui_type: schemaField?.ui_type ?? null,
      writeOnly: schemaField?.input_mode === "write_only",
    }
  })
}

const buildFieldNamesForMode = (
  mode: "create" | "edit",
  schemaFields: SchemaField[],
  relationLookups: RelationLookups,
  readOnlyFieldSet: Set<string>,
  schemaFieldsByName: Map<string, SchemaField>,
  relationshipFieldSet: Set<string>,
  record: Record<string, unknown> | null
) => {
  const virtualLookupFieldNames = getVirtualLookupFieldNames(
    relationLookups,
    schemaFieldsByName
  ).filter((fieldName) => !readOnlyFieldSet.has(fieldName))
  const representedRelationshipNames = new Set(
    Object.values(relationLookups).flatMap((lookup) => {
      if (!lookup.foreign_key || !schemaFieldsByName.has(lookup.foreign_key)) {
        return []
      }

      const names = []
      if (lookup.foreign_table) {
        names.push(lookup.foreign_table)
      }
      if (lookup.foreign_key.endsWith("_id")) {
        names.push(lookup.foreign_key.slice(0, -3))
      }

      return names
    })
  )

  if (mode === "create") {
    const editableSchemaFieldNames = schemaFields
      .filter((field) => isEditableCreateField(field, readOnlyFieldSet))
      .map((field) => field.name)

    return [...editableSchemaFieldNames, ...virtualLookupFieldNames]
  }

  const schemaFieldNames = schemaFields.map((field) => field.name)
  const extraFieldNames = record
    ? Object.keys(record).filter(
        (fieldName) =>
          !schemaFieldsByName.has(fieldName) &&
          !relationshipFieldSet.has(fieldName) &&
          !representedRelationshipNames.has(fieldName)
      )
    : []

  return [
    ...new Set([
      ...schemaFieldNames,
      ...virtualLookupFieldNames,
      ...extraFieldNames,
    ]),
  ]
}

const coerceFieldValue = (
  rawValue: string,
  type: DetailFieldType,
  nullable: boolean
) => {
  if (type === "json") {
    return rawValue
  }

  if (rawValue === "") {
    return nullable ? null : ""
  }

  switch (type) {
    case "bool":
      if (rawValue === "__null") {
        return null
      }
      return rawValue === "true"
    case "int": {
      const parsedValue = Number.parseInt(rawValue, 10)
      return Number.isNaN(parsedValue) ? rawValue : parsedValue
    }
    case "float":
    case "Decimal": {
      const parsedValue = Number(rawValue)
      return Number.isNaN(parsedValue) ? rawValue : parsedValue
    }
    default:
      return rawValue
  }
}

const hasRelationValue = (value: RelationLookupValue): boolean => {
  if (Array.isArray(value)) {
    return value.length > 0
  }

  return value !== null && value !== ""
}

type BuildSavePayloadResult = {
  columnPayload: Record<string, unknown>
  relationPayload: RelationLookupPayload
  invalidJsonField?: string
  missingRequiredField?: string
}

const buildSavePayload = ({
  fieldDefinitions,
  formValues,
  readOnlyFieldSet,
  relationshipFieldSet,
  schemaFieldsByName,
  lookupByFieldName,
}: {
  fieldDefinitions: ResolvedFieldDefinition[]
  formValues: Record<string, unknown>
  readOnlyFieldSet: Set<string>
  relationshipFieldSet: Set<string>
  schemaFieldsByName: Map<string, SchemaField>
  lookupByFieldName: Record<string, RelationLookup>
}): BuildSavePayloadResult => {
  const columnPayload: Record<string, unknown> = {}
  const relationPayload: RelationLookupPayload = {}

  for (const field of fieldDefinitions) {
    if (readOnlyFieldSet.has(field.name)) {
      continue
    }

    const currentValue = formValues[field.name]
    const isRealColumn = schemaFieldsByName.has(field.name)
    const lookup = lookupByFieldName[field.name]

    if (
      field.required &&
      (currentValue === "" ||
        currentValue === null ||
        currentValue === undefined)
    ) {
      return {
        columnPayload,
        relationPayload,
        missingRequiredField: field.name,
      }
    }

    if (
      field.writeOnly &&
      field.nullable &&
      (currentValue === "" ||
        currentValue === null ||
        currentValue === undefined)
    ) {
      continue
    }

    if (relationshipFieldSet.has(field.name) && !isRealColumn) {
      if (!lookup) {
        continue
      }
      relationPayload[field.name] =
        lookup.relation_kind === "many"
          ? Array.isArray(currentValue)
            ? currentValue
                .map((item) => normalizeLookupPrimitive(item))
                .filter((item): item is LookupPrimitive => item !== null)
            : []
          : normalizeLookupPrimitive(currentValue)
      continue
    }

    if (field.data_type === "json" && typeof currentValue === "string") {
      if (currentValue.trim() === "") {
        columnPayload[field.name] = field.nullable ? null : ""
        continue
      }

      try {
        columnPayload[field.name] = JSON.parse(currentValue)
      } catch {
        return {
          columnPayload,
          relationPayload,
          invalidJsonField: field.name,
        }
      }
      continue
    }

    columnPayload[field.name] = currentValue
  }

  return { columnPayload, relationPayload }
}

const formatValidationError = (error: ApiValidationError) => {
  if (!error.detail.length) {
    return error.message
  }

  return error.detail
    .map((issue: { loc?: unknown[]; msg?: string }) => {
      const location = issue.loc
        ?.map((entry: unknown) => String(entry))
        .filter(Boolean)
        .join(".") ?? ""
      return location.length > 0 ? `${location}: ${issue.msg}` : issue.msg
    })
    .join(" | ")
}

const resolveSaveErrorMessage = (
  saveError: unknown,
  fallbackMessage: string
) => {
  if (saveError instanceof ApiValidationError) {
    return formatValidationError(saveError)
  }

  if (saveError instanceof Error && saveError.message.trim().length > 0) {
    return saveError.message
  }

  return fallbackMessage
}

const resolveTextInputType = (
  field: ResolvedFieldDefinition
): React.HTMLInputTypeAttribute => {
  if (
    field.ui_type === "email" ||
    field.ui_type === "tel" ||
    field.ui_type === "url"
  ) {
    return field.ui_type
  }

  if (
    field.data_type === "int" ||
    field.data_type === "float" ||
    field.data_type === "Decimal"
  ) {
    return "number"
  }

  if (field.data_type === "date") {
    return "date"
  }

  if (field.data_type === "datetime") {
    return "datetime-local"
  }

  if (field.data_type === "time") {
    return "time"
  }

  return "text"
}

function PasswordInput({
  id,
  value,
  readOnly,
  required,
  onChange,
  className,
}: {
  id: string
  value: string
  readOnly?: boolean
  required?: boolean
  onChange: React.ChangeEventHandler<HTMLInputElement>
  className?: string
}) {
  const [isPasswordVisible, setIsPasswordVisible] = React.useState(false)

  return (
    <div className="relative">
      <Input
        id={id}
        value={value}
        readOnly={readOnly}
        required={required}
        autoComplete="new-password"
        onChange={onChange}
        type={isPasswordVisible ? "text" : "password"}
        className={cn("pr-10", className)}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="absolute top-0.5 right-0.5"
        disabled={readOnly}
        aria-label={isPasswordVisible ? "Ukryj hasło" : "Pokaż hasło"}
        onClick={() => setIsPasswordVisible((current) => !current)}
      >
        {isPasswordVisible ? <RiEyeOffLine /> : <RiEyeLine />}
      </Button>
    </div>
  )
}

type ActionFeedbackType = "saved" | "archived"

const ACTION_FEEDBACK_DURATION_MS = 900

function ActionResultOverlay({ action }: { action: ActionFeedbackType }) {
  const isSaved = action === "saved"

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] flex animate-in items-center justify-center bg-background/45 backdrop-blur-sm duration-150 fade-in-0">
      <div
        className={cn(
          "flex size-24 animate-in items-center justify-center rounded-full border-2 shadow-lg ring-4 ring-background/60 duration-150 zoom-in-90",
          isSaved
            ? "border-emerald-500 bg-emerald-500/15 text-emerald-600"
            : "border-zinc-500 bg-zinc-500/15 text-zinc-600"
        )}
      >
        {isSaved ? (
          <RiCheckLine className="size-12" />
        ) : (
          <RiCloseLine className="size-12" />
        )}
      </div>
    </div>
  )
}

function DetailActions({
  isCreateMode,
  canSave,
  isSaving,
  isLoading,
  isActionFeedbackVisible,
  onArchive,
  onSave,
}: {
  isCreateMode: boolean
  canSave: boolean
  isSaving: boolean
  isLoading: boolean
  isActionFeedbackVisible: boolean
  onArchive?: () => void
  onSave: () => void
}) {
  const areActionsDisabled = isSaving || isLoading || isActionFeedbackVisible

  return (
    <div className="flex w-full gap-2">
      {!isCreateMode && onArchive ? (
        <Button
          variant="outline"
          className="flex-1"
          onClick={onArchive}
          disabled={areActionsDisabled}
        >
          <RiArchiveLine data-icon="inline-start" />
          Archiwizuj
        </Button>
      ) : null}
      {canSave ? (
        <Button
          className="flex-1"
          onClick={onSave}
          disabled={areActionsDisabled}
        >
          {isSaving ? (
            <RiLoader4Line data-icon="inline-start" className="animate-spin" />
          ) : (
            <RiSaveLine data-icon="inline-start" />
          )}
          {isSaving
            ? isCreateMode
              ? "Tworzenie..."
              : "Zapisywanie..."
            : isCreateMode
              ? "Utwórz"
              : "Zapisz"}
        </Button>
      ) : null}
    </div>
  )
}

export function RecordDetailSheet<TRecord extends Record<string, unknown>>({
  api,
  schemaRoute,
  baseRoute,
  recordId = null,
  isOpen,
  mode = "edit",
  entityLabel,
  readOnlyFields = [],
  onClose,
  loadRecord,
  updateRecord,
  createRecord,
  onCreated,
  syncRelations,
  onArchive,
  getRecordTitle,
  schemaOverride,
  customFields,
}: RecordDetailSheetProps<TRecord>) {
  const isCreateMode = mode === "create"
  const isSheetOpen = isCreateMode ? (isOpen ?? false) : recordId !== null
  const isMobile = useIsMobile()
  const [schemaFields, setSchemaFields] = React.useState<SchemaField[]>([])
  const [relationLookups, setRelationLookups] = React.useState<RelationLookups>(
    {}
  )
  const [record, setRecord] = React.useState<TRecord | null>(null)
  const [formValues, setFormValues] = React.useState<Record<string, unknown>>(
    {}
  )
  const [isLoading, setIsLoading] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [saveErrorMessage, setSaveErrorMessage] = React.useState<string | null>(
    null
  )
  const [actionFeedback, setActionFeedback] =
    React.useState<ActionFeedbackType | null>(null)
  const readOnlyFieldSet = React.useMemo(
    () => new Set(readOnlyFields),
    [readOnlyFields]
  )
  const activeCustomSchemaFields = React.useMemo(
    () =>
      (customFields ?? EMPTY_CUSTOM_FIELDS)
        .filter((field) => isCustomFieldEnabledForMode(field, mode))
        .map(customFieldToSchemaField),
    [customFields, mode]
  )
  const formSchemaFields = React.useMemo(
    () => mergeSchemaFields(schemaFields, activeCustomSchemaFields),
    [activeCustomSchemaFields, schemaFields]
  )
  const relationshipFieldSet = React.useMemo(
    () => new Set(Object.keys(relationLookups)),
    [relationLookups]
  )
  const lookupByFieldName = React.useMemo(
    () => createLookupFieldMap(relationLookups),
    [relationLookups]
  )
  const schemaFieldsByName = React.useMemo(
    () => new Map(formSchemaFields.map((field) => [field.name, field])),
    [formSchemaFields]
  )
  const canSave = isCreateMode ? Boolean(createRecord) : Boolean(updateRecord)
  const isRecordReadOnly = !isCreateMode && !canSave
  const isActionFeedbackVisible = actionFeedback !== null

  const showActionFeedback = React.useCallback(
    (nextAction: ActionFeedbackType) => {
      if (isCreateMode) {
        return
      }
      setActionFeedback(nextAction)
    },
    [isCreateMode]
  )

  React.useEffect(() => {
    if (!actionFeedback) {
      return
    }

    const timeoutId = setTimeout(() => {
      setActionFeedback(null)
    }, ACTION_FEEDBACK_DURATION_MS)

    return () => clearTimeout(timeoutId)
  }, [actionFeedback])

  React.useEffect(() => {
    if (!isSheetOpen) {
      setActionFeedback(null)
      return
    }

    // Сбрасываем эффект при открытии другой записи/режима, чтобы
    // оверлей никогда не "залипал" между открытиями карточки.
    setActionFeedback(null)
  }, [isSheetOpen, isCreateMode, recordId])

  const effectiveReadOnlyFieldSet = React.useMemo(() => {
    if (!isRecordReadOnly) {
      return readOnlyFieldSet
    }

    return new Set([
      ...readOnlyFieldSet,
      ...formSchemaFields.map((field) => field.name),
      ...Object.keys(formValues),
    ])
  }, [formSchemaFields, formValues, isRecordReadOnly, readOnlyFieldSet])

  React.useEffect(() => {
    if (!isSheetOpen) {
      return
    }

    let isCancelled = false

    const loadDetail = async () => {
      setIsLoading(true)
      setError(null)
      setSaveErrorMessage(null)

      try {
        const schema = schemaOverride ?? (await api.getSchema(schemaRoute))

        if (isCancelled) {
          return
        }

        setSchemaFields(schema.fields)
        setRelationLookups(schema.relation_lookups ?? {})
        const nextFormSchemaFields = mergeSchemaFields(
          schema.fields,
          activeCustomSchemaFields
        )

        if (isCreateMode) {
          setRecord(null)
          setFormValues(
            buildInitialCreateValues(nextFormSchemaFields, readOnlyFieldSet)
          )
          return
        }

        if (recordId === null || !loadRecord) {
          setError("Brak konfiguracji ładowania rekordu.")
          setRecord(null)
          setFormValues({})
          return
        }

        const loadedRecord = await loadRecord(recordId)

        if (isCancelled) {
          return
        }

        const loadedRecordData = loadedRecord as Record<string, unknown>
        const schemaLookups = schema.relation_lookups ?? {}
        const normalizedValues = normalizeRecordFormValues(
          loadedRecordData,
          nextFormSchemaFields,
          schemaLookups
        )

        setRecord(loadedRecord)
        setFormValues(normalizedValues)
      } catch (loadError) {
        if (!isCancelled) {
          setRelationLookups({})
          setRecord(null)
          setFormValues({})
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Nie udało się pobrać danych rekordu."
          )
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadDetail()

    return () => {
      isCancelled = true
    }
  }, [
    api,
    isCreateMode,
    isSheetOpen,
    loadRecord,
    readOnlyFieldSet,
    recordId,
    schemaRoute,
    schemaOverride,
    activeCustomSchemaFields,
  ])

  const fieldDefinitions = React.useMemo(() => {
    if (!isSheetOpen) {
      return []
    }

    if (!isCreateMode && !record) {
      return []
    }

    return buildFieldDefinitions(
      buildFieldNamesForMode(
        mode,
        formSchemaFields,
        relationLookups,
        readOnlyFieldSet,
        schemaFieldsByName,
        relationshipFieldSet,
        record as Record<string, unknown> | null
      ),
      formSchemaFields,
      formValues,
      effectiveReadOnlyFieldSet,
      lookupByFieldName
    )
  }, [
    effectiveReadOnlyFieldSet,
    formValues,
    isCreateMode,
    mode,
    lookupByFieldName,
    relationLookups,
    isSheetOpen,
    readOnlyFieldSet,
    record,
    relationshipFieldSet,
    formSchemaFields,
    schemaFieldsByName,
  ])

  const groupedFieldDefinitions = React.useMemo<FieldGroup[]>(() => {
    const grouped: Record<FieldGroup["key"], ResolvedFieldDefinition[]> = {
      main: [],
      relations: [],
      "many-relations": [],
      system: [],
    }

    for (const field of fieldDefinitions) {
      const schemaField = schemaFieldsByName.get(field.name)
      const lookup = lookupByFieldName[field.name]
      const hasForeignKey = (schemaField?.foreign_keys?.length ?? 0) > 0
      const hasLookup = Boolean(lookup)
      const isManyRelation = lookup?.relation_kind === "many"
      const isSystemField =
        effectiveReadOnlyFieldSet.has(field.name) ||
        field.name === "id" ||
        CREATE_HIDDEN_FIELD_NAMES.has(field.name)

      if (isManyRelation) {
        grouped["many-relations"].push(field)
        continue
      }

      if (hasLookup || hasForeignKey) {
        grouped.relations.push(field)
        continue
      }

      if (isSystemField) {
        grouped.system.push(field)
        continue
      }

      grouped.main.push(field)
    }

    const sections: Omit<FieldGroup, "fields">[] = [
      {
        key: "main",
        title: "Pola podstawowe",
        description: "Główne dane rekordu.",
      },
      {
        key: "relations",
        title: "Powiązania",
        description: "Dane innych tabeli.",
      },
      {
        key: "many-relations",
        title: "Powiązania N-M",
        description: "Relacje many-to-many edytowane tabelarycznie.",
      },
      {
        key: "system",
        title: "Pola systemowe",
        description: "Informacje techniczne i pola tylko do odczytu.",
      },
    ]

    return sections
      .filter((section) => grouped[section.key].length > 0)
      .map((section) => ({
        ...section,
        fields: grouped[section.key],
      }))
  }, [
    effectiveReadOnlyFieldSet,
    fieldDefinitions,
    lookupByFieldName,
    schemaFieldsByName,
  ])

  const detailTitle = React.useMemo(() => {
    if (isCreateMode) {
      return `Nowy ${entityLabel}`
    }

    if (recordId === null) {
      return entityLabel
    }

    return getRecordTitle?.(record, recordId) ?? `${entityLabel} #${recordId}`
  }, [entityLabel, getRecordTitle, isCreateMode, record, recordId])

  const handleFieldChange = (
    fieldName: string,
    fieldType: DetailFieldType,
    nullable: boolean,
    rawValue: string
  ) => {
    setFormValues((current) => ({
      ...current,
      [fieldName]: coerceFieldValue(rawValue, fieldType, nullable),
    }))
  }

  const handleBooleanChange = (fieldName: string, checked: boolean) => {
    setFormValues((current) => ({
      ...current,
      [fieldName]: checked,
    }))
  }

  const handleFieldReset = (fieldName: string) => {
    setFormValues((current) => ({
      ...current,
      [fieldName]: null,
    }))
  }

  const handleLookupChange = (
    fieldName: string,
    lookup: RelationLookup,
    value: RelationLookupValue
  ) => {
    if (lookup.relation_kind === "many") {
      const nextValues = Array.isArray(value)
        ? value.filter((item): item is LookupPrimitive => item !== null)
        : []
      setFormValues((current) => ({
        ...current,
        [fieldName]: nextValues,
      }))
      return
    }

    if (value === null || value === "__null") {
      setFormValues((current) => ({
        ...current,
        [fieldName]: null,
      }))
      return
    }

    const nextValue = Array.isArray(value) ? (value[0] ?? null) : value
    setFormValues((current) => ({
      ...current,
      [fieldName]: nextValue,
    }))
  }

  const handleSave = async () => {
    const {
      columnPayload,
      relationPayload,
      invalidJsonField,
      missingRequiredField,
    } = buildSavePayload({
      fieldDefinitions,
      formValues,
      readOnlyFieldSet,
      relationshipFieldSet,
      schemaFieldsByName,
      lookupByFieldName,
    })

    if (missingRequiredField) {
      const message = `Pole ${missingRequiredField} jest wymagane.`
      setSaveErrorMessage(message)
      toast.error(message)
      return
    }

    if (invalidJsonField) {
      const message = `Pole ${invalidJsonField} nie zawiera poprawnego JSON.`
      setSaveErrorMessage(message)
      toast.error(message)
      return
    }

    setSaveErrorMessage(null)
    setIsSaving(true)

    try {
      let savedRecord: TRecord

      if (isCreateMode) {
        if (!createRecord) {
          const message = "Brak konfiguracji tworzenia rekordu."
          setSaveErrorMessage(message)
          toast.error(message)
          return
        }

        savedRecord = await createRecord(columnPayload)
        const savedRecordData = savedRecord as Record<string, unknown>
        const normalizedFormValues = normalizeRecordFormValues(
          savedRecordData,
          formSchemaFields,
          relationLookups,
          formValues
        )
        setRecord(savedRecord)
        setFormValues(normalizedFormValues)

        if (syncRelations && typeof savedRecordData.id === "number") {
          await syncRelations(savedRecordData.id, relationPayload)
        } else if (
          Object.values(relationPayload).some((relationValue) =>
            hasRelationValue(relationValue)
          )
        ) {
          toast.info(
            "Powiązania N-M/1-N wymagają dedykowanego endpointu synchronizacji."
          )
        }

        toast.success("Rekord został utworzony.")
        setSaveErrorMessage(null)
        await onCreated?.(savedRecord)
        onClose()
        return
      }

      if (recordId === null || !updateRecord) {
        const message = "Brak konfiguracji zapisu rekordu."
        toast.error(message)
        return
      }

      savedRecord = await updateRecord(recordId, columnPayload)
      const savedRecordData = savedRecord as Record<string, unknown>
      const normalizedFormValues = normalizeRecordFormValues(
        savedRecordData,
        formSchemaFields,
        relationLookups,
        formValues
      )
      setRecord(savedRecord)
      setFormValues(normalizedFormValues)

      if (syncRelations) {
        await syncRelations(recordId, relationPayload)
      } else if (
        Object.values(relationPayload).some((relationValue) =>
          hasRelationValue(relationValue)
        )
      ) {
        toast.info(
          "Powiązania N-M/1-N wymagają dedykowanego endpointu synchronizacji."
        )
      }

      showActionFeedback("saved")
      toast.success("Zmiany zostały zapisane.")
      setSaveErrorMessage(null)
    } catch (saveError) {
      const message = resolveSaveErrorMessage(
        saveError,
        isCreateMode
          ? "Nie udało się utworzyć rekordu."
          : "Nie udało się zapisać zmian."
      )
      if (isCreateMode) {
        setSaveErrorMessage(message)
      }
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleArchive = React.useCallback(async () => {
    if (!onArchive || isLoading || isSaving || isActionFeedbackVisible) {
      return
    }

    showActionFeedback("archived")
    await new Promise<void>((resolve) => {
      setTimeout(resolve, ACTION_FEEDBACK_DURATION_MS)
    })
    await onArchive(record)
  }, [
    isActionFeedbackVisible,
    isLoading,
    isSaving,
    onArchive,
    record,
    showActionFeedback,
  ])

  const content = (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {isLoading ? (
          <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
            {isCreateMode
              ? "Ładowanie formularza..."
              : "Ładowanie danych rekordu..."}
          </div>
        ) : error ? (
          <div className="flex min-h-40 items-center justify-center text-sm text-destructive">
            {error}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <Card size="sm">
              <CardHeader>
                <CardTitle className="text-2xl leading-tight md:text-3xl">
                  {detailTitle}
                </CardTitle>
                <CardDescription>
                  {isCreateMode
                    ? `${baseRoute}/new`
                    : `${baseRoute}/${recordId}`}
                </CardDescription>
              </CardHeader>
            </Card>
            {isCreateMode && saveErrorMessage ? (
              <div className="rounded-lg border border-destructive/60 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {saveErrorMessage}
              </div>
            ) : null}
            <Separator />
            <div className="flex flex-col gap-4">
              {groupedFieldDefinitions.map((group) => (
                <section key={group.key} className="space-y-2">
                  <div className="px-1">
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      {group.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {group.description}
                    </p>
                  </div>
                  <div
                    className={cn(
                      "grid gap-2",
                      group.key === "many-relations"
                        ? "grid-cols-1"
                        : "lg:grid-cols-2 xl:grid-cols-3"
                    )}
                  >
                    {group.fields.map((field) => {
                      const isReadOnly = effectiveReadOnlyFieldSet.has(
                        field.name
                      )
                      const lookup = lookupByFieldName[field.name]
                      const lookupForeignTable = lookup
                        ? getLookupForeignTable(lookup)
                        : null
                      const rawValue = formValues[field.name]
                      const hasAllowedValues = field.allowedValues.length > 0
                      const normalizedValue =
                        field.data_type === "bool"
                          ? rawValue === null || rawValue === undefined
                            ? "__null"
                            : rawValue
                              ? "true"
                              : "false"
                          : normalizeInputValue(rawValue, field.data_type)

                      return (
                        <Card key={field.name} size="sm" className="gap-3">
                          <CardHeader className="pb-0">
                            <CardTitle className="text-sm">
                              {field.transcription}
                            </CardTitle>
                            <CardDescription className="text-xs">
                              {field.fieldMetaDescription}
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            {lookup ? (
                              <div className="flex flex-col gap-2">
                                {lookupForeignTable ? (
                                  <p className="text-[11px] text-muted-foreground">
                                    Foreign table: {lookupForeignTable}
                                  </p>
                                ) : null}
                                <RelationSelect
                                  api={api}
                                  id={`${schemaRoute}-${field.name}`}
                                  lookup={lookup}
                                  value={rawValue}
                                  resetKey={`${isCreateMode ? "create" : "edit"}-${recordId ?? "none"}-${field.name}`}
                                  disabled={isReadOnly}
                                  nullable={field.nullable}
                                  onChange={(value) =>
                                    handleLookupChange(
                                      field.name,
                                      lookup,
                                      value
                                    )
                                  }
                                />
                              </div>
                            ) : hasAllowedValues ? (
                              <Select
                                disabled={isReadOnly}
                                value={
                                  rawValue === null
                                    ? "__null"
                                    : rawValue === undefined || rawValue === ""
                                      ? undefined
                                      : String(rawValue)
                                }
                                onValueChange={(value) =>
                                  handleFieldChange(
                                    field.name,
                                    field.data_type,
                                    field.nullable,
                                    value
                                  )
                                }
                              >
                                <SelectTrigger
                                  id={`${schemaRoute}-${field.name}`}
                                  className="w-full"
                                >
                                  <SelectValue placeholder="Wybierz wartość" />
                                </SelectTrigger>
                                <SelectContent align="start">
                                  {field.nullable ? (
                                    <SelectItem value="__null">
                                      Brak wartości
                                    </SelectItem>
                                  ) : null}
                                  {field.allowedValues.map((allowedValue) => (
                                    <SelectItem
                                      key={`${field.name}-${String(allowedValue)}`}
                                      value={String(allowedValue)}
                                    >
                                      {String(allowedValue)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : field.data_type === "bool" ? (
                              <div
                                className={cn(
                                  "flex flex-wrap items-center gap-2 rounded-lg border border-input px-2.5 py-2 sm:gap-3",
                                  isReadOnly &&
                                    "bg-muted/40 text-muted-foreground"
                                )}
                              >
                                <label
                                  htmlFor={`${schemaRoute}-${field.name}`}
                                  className={cn(
                                    "flex min-w-0 items-center gap-2",
                                    !isReadOnly && "cursor-pointer"
                                  )}
                                >
                                  <Checkbox
                                    id={`${schemaRoute}-${field.name}`}
                                    checked={rawValue === true}
                                    disabled={isReadOnly}
                                    onCheckedChange={(checked) =>
                                      handleBooleanChange(
                                        field.name,
                                        checked === true
                                      )
                                    }
                                  />
                                  <p className="text-sm font-medium">
                                    {rawValue === null || rawValue === undefined
                                      ? "Brak wartości"
                                      : rawValue
                                        ? "Tak"
                                        : "Nie"}
                                  </p>
                                </label>
                                {field.nullable ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="ml-auto shrink-0"
                                    disabled={isReadOnly}
                                    onClick={() => handleFieldReset(field.name)}
                                  >
                                    Wyczyść
                                  </Button>
                                ) : null}
                              </div>
                            ) : field.data_type === "date" &&
                              field.ui_type === "month" ? (
                              <MonthPicker
                                id={`${schemaRoute}-${field.name}`}
                                value={normalizedValue}
                                disabled={isReadOnly}
                                nullable={field.nullable}
                                onChange={(value) =>
                                  handleFieldChange(
                                    field.name,
                                    field.data_type,
                                    field.nullable,
                                    value
                                  )
                                }
                              />
                            ) : field.data_type === "date" ? (
                              <DatePicker
                                id={`${schemaRoute}-${field.name}`}
                                value={normalizedValue}
                                disabled={isReadOnly}
                                nullable={field.nullable}
                                onChange={(value) =>
                                  handleFieldChange(
                                    field.name,
                                    field.data_type,
                                    field.nullable,
                                    value
                                  )
                                }
                              />
                            ) : field.data_type === "json" ? (
                              <textarea
                                id={`${schemaRoute}-${field.name}`}
                                value={normalizedValue}
                                readOnly={isReadOnly}
                                onChange={(event) =>
                                  handleFieldChange(
                                    field.name,
                                    field.data_type,
                                    field.nullable,
                                    event.target.value
                                  )
                                }
                                className={cn(
                                  "min-h-32 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 font-mono text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                                  isReadOnly &&
                                    "bg-muted/40 text-muted-foreground"
                                )}
                              />
                            ) : field.ui_type === "password" ? (
                              <PasswordInput
                                id={`${schemaRoute}-${field.name}`}
                                value={normalizedValue}
                                readOnly={isReadOnly}
                                required={field.required}
                                onChange={(event) =>
                                  handleFieldChange(
                                    field.name,
                                    field.data_type,
                                    field.nullable,
                                    event.target.value
                                  )
                                }
                                className={
                                  isReadOnly
                                    ? "bg-muted/40 text-muted-foreground"
                                    : undefined
                                }
                              />
                            ) : (
                              <Input
                                id={`${schemaRoute}-${field.name}`}
                                value={normalizedValue}
                                readOnly={isReadOnly}
                                required={field.required}
                                onChange={(event) =>
                                  handleFieldChange(
                                    field.name,
                                    field.data_type,
                                    field.nullable,
                                    event.target.value
                                  )
                                }
                                type={resolveTextInputType(field)}
                                className={
                                  isReadOnly
                                    ? "bg-muted/40 text-muted-foreground"
                                    : undefined
                                }
                              />
                            )}
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          </div>
        )}
      </div>
      {isMobile ? (
        <DrawerFooter className="border-t">
          <DetailActions
            isCreateMode={isCreateMode}
            canSave={canSave}
            isSaving={isSaving}
            isLoading={isLoading}
            isActionFeedbackVisible={isActionFeedbackVisible}
            onArchive={() => void handleArchive()}
            onSave={() => void handleSave()}
          />
        </DrawerFooter>
      ) : (
        <SheetFooter className="border-t">
          <DetailActions
            isCreateMode={isCreateMode}
            canSave={canSave}
            isSaving={isSaving}
            isLoading={isLoading}
            isActionFeedbackVisible={isActionFeedbackVisible}
            onArchive={() => void handleArchive()}
            onSave={() => void handleSave()}
          />
        </SheetFooter>
      )}
    </>
  )

  if (!isSheetOpen) {
    return null
  }

  if (isMobile) {
    return (
      <Drawer
        open={isSheetOpen}
        onOpenChange={(open) => !open && onClose()}
        direction="bottom"
      >
        <DrawerContent className="max-h-[88vh]">
          <DrawerHeader>
            <DrawerTitle>{detailTitle}</DrawerTitle>
            <DrawerDescription>
              {isCreateMode
                ? "Tworzenie nowego rekordu."
                : "Pełny widok i edycja rekordu."}
            </DrawerDescription>
          </DrawerHeader>
          {content}
          {isActionFeedbackVisible && actionFeedback ? (
            <ActionResultOverlay action={actionFeedback} />
          ) : null}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Sheet open={isSheetOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="gap-0 data-[side=right]:w-full data-[side=right]:max-w-[92vw] md:data-[side=right]:max-w-[75vw]"
      >
        <SheetHeader className="border-b">
          <SheetTitle>{detailTitle}</SheetTitle>
          <SheetDescription>
            {isCreateMode
              ? "Tworzenie nowego rekordu."
              : "Pełny widok i edycja rekordu."}
          </SheetDescription>
        </SheetHeader>
        {content}
        {isActionFeedbackVisible && actionFeedback ? (
          <ActionResultOverlay action={actionFeedback} />
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
