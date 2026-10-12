export const equipmentTypes = [
  "SOURCE",
  "TRANSFORMER",
  "PANEL",
  "BUSBAR",
  "CIRCUIT_BREAKER",
  "SWITCH",
  "TIE",
  "MOTOR",
  "LOAD",
  "GENERATOR",
] as const;
export type EquipmentType = (typeof equipmentTypes)[number];
export type Properties = Record<string, number | string>;
export type Field = {
  key: string;
  label: string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: number | string; label: string }[];
};
export type EquipmentDefinition = {
  name: string;
  short: string;
  category: string;
  color: string;
  defaults: Properties;
  fields: Field[];
};
const voltage: Field = {
  key: "voltage_v",
  label: "Tensão nominal",
  unit: "V",
  min: 1,
  max: 1000000,
};
const phases: Field = {
  key: "phases",
  label: "Sistema",
  options: [
    { value: 3, label: "Trifásico" },
    { value: 1, label: "Monofásico" },
  ],
};
const current: Field = {
  key: "nominal_current_a",
  label: "Corrente nominal",
  unit: "A",
  min: 0.1,
  max: 1000000,
};
const powerFactor: Field = {
  key: "power_factor",
  label: "Fator de potência",
  min: 0.01,
  max: 1,
  step: 0.01,
};
const demand: Field = {
  key: "demand_factor",
  label: "Fator de demanda",
  min: 0,
  max: 1,
  step: 0.05,
};
export const catalog: Record<EquipmentType, EquipmentDefinition> = {
  SOURCE: {
    name: "Concessionária",
    short: "Rede",
    category: "Alimentação",
    color: "#5d6bc0",
    defaults: { voltage_v: 13800, phases: 3, frequency_hz: 60 },
    fields: [
      voltage,
      phases,
      {
        key: "frequency_hz",
        label: "Frequência",
        unit: "Hz",
        min: 1,
        max: 1000,
      },
    ],
  },
  TRANSFORMER: {
    name: "Transformador",
    short: "Trafo",
    category: "Alimentação",
    color: "#aa7b42",
    defaults: {
      power_kva: 300,
      primary_voltage_v: 13800,
      voltage_v: 380,
      phases: 3,
      impedance_percent: 5,
    },
    fields: [
      {
        key: "power_kva",
        label: "Potência nominal",
        unit: "kVA",
        min: 0.1,
        max: 1000000,
      },
      {
        key: "primary_voltage_v",
        label: "Tensão primária",
        unit: "V",
        min: 1,
        max: 1000000,
      },
      { ...voltage, label: "Tensão secundária" },
      phases,
      {
        key: "impedance_percent",
        label: "Impedância",
        unit: "%",
        min: 0.01,
        max: 100,
        step: 0.1,
      },
    ],
  },
  PANEL: {
    name: "Painel elétrico",
    short: "Painel",
    category: "Distribuição",
    color: "#217a63",
    defaults: { voltage_v: 380, phases: 3, nominal_current_a: 630 },
    fields: [voltage, phases, current],
  },
  BUSBAR: {
    name: "Barramento",
    short: "Barra",
    category: "Distribuição",
    color: "#217a63",
    defaults: { nominal_current_a: 630 },
    fields: [current],
  },
  CIRCUIT_BREAKER: {
    name: "Disjuntor",
    short: "Disjuntor",
    category: "Proteção",
    color: "#63819b",
    defaults: { nominal_current_a: 100, poles: 3, curve: "C" },
    fields: [
      current,
      {
        key: "poles",
        label: "Polos",
        options: [
          { value: 1, label: "1 polo" },
          { value: 2, label: "2 polos" },
          { value: 3, label: "3 polos" },
          { value: 4, label: "4 polos" },
        ],
      },
      {
        key: "curve",
        label: "Curva",
        options: ["B", "C", "D"].map((value) => ({ value, label: value })),
      },
    ],
  },
  SWITCH: {
    name: "Seccionadora",
    short: "Chave",
    category: "Proteção",
    color: "#63819b",
    defaults: { nominal_current_a: 160 },
    fields: [current],
  },
  TIE: {
    name: "Acoplamento TIE",
    short: "TIE",
    category: "Distribuição",
    color: "#63819b",
    defaults: { nominal_current_a: 400 },
    fields: [current],
  },
  MOTOR: {
    name: "Motor",
    short: "Motor",
    category: "Cargas",
    color: "#5384a3",
    defaults: {
      power_kw: 30,
      voltage_v: 380,
      phases: 3,
      power_factor: 0.85,
      efficiency: 0.92,
      demand_factor: 1,
    },
    fields: [
      {
        key: "power_kw",
        label: "Potência no eixo",
        unit: "kW",
        min: 0,
        max: 1000000,
      },
      voltage,
      phases,
      powerFactor,
      { key: "efficiency", label: "Rendimento", min: 0.01, max: 1, step: 0.01 },
      demand,
    ],
  },
  LOAD: {
    name: "Carga",
    short: "Carga",
    category: "Cargas",
    color: "#8c75a7",
    defaults: {
      power_kw: 15,
      voltage_v: 380,
      phases: 3,
      power_factor: 0.95,
      demand_factor: 1,
    },
    fields: [
      {
        key: "power_kw",
        label: "Potência ativa",
        unit: "kW",
        min: 0,
        max: 1000000,
      },
      voltage,
      phases,
      powerFactor,
      demand,
    ],
  },
  GENERATOR: {
    name: "Gerador",
    short: "Gerador",
    category: "Alimentação",
    color: "#5d6bc0",
    defaults: { power_kva: 250, voltage_v: 380, phases: 3 },
    fields: [
      {
        key: "power_kva",
        label: "Potência nominal",
        unit: "kVA",
        min: 0.1,
        max: 1000000,
      },
      voltage,
      phases,
    ],
  },
};
export const cableDefaults: Properties = {
  length_m: 25,
  section_mm2: 35,
  material: "CU",
  temperature_c: 20,
  reactance_ohm_km: 0.08,
  parallel_runs: 1,
};
export const cableFields: Field[] = [
  {
    key: "length_m",
    label: "Comprimento",
    unit: "m",
    min: 0,
    max: 1000000,
    step: 1,
  },
  {
    key: "section_mm2",
    label: "Seção por condutor",
    unit: "mm²",
    min: 0.1,
    max: 10000,
    step: 0.5,
  },
  {
    key: "material",
    label: "Condutor",
    options: [
      { value: "CU", label: "Cobre" },
      { value: "AL", label: "Alumínio" },
    ],
  },
  {
    key: "parallel_runs",
    label: "Condutores em paralelo / fase",
    min: 1,
    max: 100,
    step: 1,
  },
  {
    key: "temperature_c",
    label: "Temperatura do condutor",
    unit: "°C",
    min: -20,
    max: 250,
    step: 1,
  },
  {
    key: "reactance_ohm_km",
    label: "Reatância por condutor",
    unit: "Ω/km",
    min: 0,
    max: 100,
    step: 0.01,
  },
];
