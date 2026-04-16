import { Form, InputGroup } from 'react-bootstrap'

export interface DecisionFormFieldProps {
  label: string
  name: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  unit?: string
  helpText?: string
  disabled?: boolean
  highlight?: boolean
}

export default function DecisionFormField({
  label,
  name,
  value,
  onChange,
  min,
  max,
  step,
  unit,
  helpText,
  disabled,
  highlight,
}: DecisionFormFieldProps) {
  const borderStyle = highlight
    ? { borderColor: '#f59e0b', boxShadow: '0 0 0 1px #f59e0b' }
    : undefined

  return (
    <Form.Group className="mb-3" controlId={`field-${name}`}>
      <Form.Label className="small text-muted mb-1">{label}</Form.Label>
      <InputGroup size="sm">
        <Form.Control
          type="number"
          name={name}
          value={Number.isFinite(value) ? value : 0}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          style={borderStyle}
        />
        {unit && <InputGroup.Text>{unit}</InputGroup.Text>}
      </InputGroup>
      {helpText && <Form.Text muted>{helpText}</Form.Text>}
    </Form.Group>
  )
}

interface NumberFieldProps {
  label: string
  value: number
  onChange: (v: number) => void
  disabled?: boolean
}

export function NumberField({ label, value, onChange, disabled }: NumberFieldProps) {
  return (
    <Form.Group className="mb-2">
      <Form.Label className="small text-muted mb-1">{label}</Form.Label>
      <Form.Control
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
      />
    </Form.Group>
  )
}

interface ProductRowProps {
  label: string
  values: [number, number, number, number]
  onChange: (idx: number, v: number) => void
  disabled?: boolean
}

export function ProductRow({ label, values, onChange, disabled }: ProductRowProps) {
  return (
    <div className="mb-2">
      <div className="small text-muted mb-1">{label}</div>
      <div className="row g-2">
        {values.map((v, i) => (
          <div key={i} className="col-3">
            <Form.Control
              type="number"
              size="sm"
              value={v}
              onChange={(e) => onChange(i, Number(e.target.value))}
              disabled={disabled}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
