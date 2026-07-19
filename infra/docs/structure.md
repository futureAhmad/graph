# Graph Design Requirements

## Objective

Design a dependency graph for banking services.

The graph represents the relationship between:

Function
    └── Service
            ├── Direct Channel (DC)
            ├── Application (App)
            └── Integration (Integ)

The graph is hierarchical and interactive.

---

## Current Example

There is only one Function.

Function = 1

It contains two services:

- Stock
- Commodity

The expected graph hierarchy is:

Function (1)
├── Service (Stock)
│   ├── DC
│   │   └── Branch
│   ├── Applications
│   │   ├── CRM
│   │   └── T24
│   └── Integrations
│       ├── IBM
│       ├── MQ
│       └── M
│
└── Service (Commodity)
    ├── DC
    │   ├── Branch
    │   └── Mobile
    ├── Applications
    │   ├── CRM
    │   ├── T24
    │   ├── SUPER APP
    │   ├── MCM
    │   ├── MDM
    │   ├── SDR
    │   └── IB WEB
    └── Integrations
        ├── IBM
        ├── MQ
        └── LIQ2

---

## Important Rules

- Function is always the root node.
- A Function can have multiple Services.
- Every Service owns its own dependencies.
- Dependencies are grouped into:
    - Direct Channels (DC)
    - Applications
    - Integrations
- Duplicate nodes should not be created under the same Service.
- The graph should automatically merge identical dependency names within the same Service.
- The graph should support unlimited depth for future dependency types.

---

## Visualization Requirements

- Use a top-to-bottom tree layout.
- Root node should be visually distinct.
- Services should be displayed as the second level.
- Dependency categories (DC, Applications, Integrations) should be collapsible.
- Child nodes should expand/collapse.
- Edges should be directed from parent to child.
- The graph should support zooming and panning.
- Clicking a node should display all its metadata.

---

## Expected Mermaid Example

```mermaid
graph TD

F["Function: 1"]

F --> S1["Stock"]
F --> S2["Commodity"]

S1 --> DC1["DC"]
S1 --> APP1["Applications"]
S1 --> INT1["Integrations"]

DC1 --> B1["Branch"]

APP1 --> CRM1["CRM"]
APP1 --> T241["T24"]

INT1 --> IBM1["IBM"]
INT1 --> MQ1["MQ"]
INT1 --> M1["M"]

S2 --> DC2["DC"]
S2 --> APP2["Applications"]
S2 --> INT2["Integrations"]

DC2 --> B2["Branch"]
DC2 --> MOB["Mobile"]

APP2 --> CRM2["CRM"]
APP2 --> T242["T24"]
APP2 --> SA["SUPER APP"]
APP2 --> MCM["MCM"]
APP2 --> MDM["MDM"]
APP2 --> SDR["SDR"]
APP2 --> IBWEB["IB WEB"]

INT2 --> IBM2["IBM"]
INT2 --> MQ2["MQ"]
INT2 --> LIQ2["LIQ2"]
```

---

## Future Scalability

The implementation must not hardcode:

- Function names
- Service names
- DC names
- Application names
- Integration names

Everything must be generated dynamically from the database.

The graph component should work regardless of the number of Functions, Services, or dependency types.