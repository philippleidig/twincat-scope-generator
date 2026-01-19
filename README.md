# TwinCAT Scope Generator

A web-based tool for generating TwinCAT Scope configuration files (`.tcscopex`) using pattern-based symbol expressions. This tool simplifies the process of creating scope configurations for repetitive structures like axis arrays or multi-mover systems.

## Features

- **Pattern-based Generation**: Use simplified syntax to generate multiple acquisitions automatically.
  - Syntax: `{name:start:end}` (e.g., `{i:1:10}`)
  - Supports multiple independent counters in a single path
  - Supports reusing the same counter name for synchronized values
- **Multiple Scope Files**: Organize your patterns into multiple output `.tcscopex` files.
- **Project Bundling**: Generates a `.tcmproj` project file and bundles everything into a ZIP archive for easy import.
- **Customizable**:
  - Configure target ADS ports (Presets for PLC 1-4, NC, etc., or custom)
  - Select data types (REAL64, INT32, BIT, etc.)
  - Set global recording settings (sample time, record time)
- **Local Persistence**: Your configuration is automatically saved in your browser's local storage.
- **Dark/Light Mode**: (Coming soon) currently optimized for a clean, modern red/white theme.

## Usage

1. **Add Scope Files**: logical groups for your measurements (e.g., "Axes", "IO").
2. **Add Patterns**: Define symbol paths with counters.
   - Example: `MAIN.Mover[{i:1:10}].stStatus.fActPosition`
   - This will generate 10 acquisitions: `MAIN.Mover[1]...`, `MAIN.Mover[2]...`, etc.
3. **Configure Settings**: Set the AMS Net ID of your target system.
4. **Download**: Click "Download ZIP" to get a `.tcmproj` containing all your configured `.tcscopex` files.

## Development

This project is built with React, TypeScript, and Vite.

### Prerequisites

- Node.js (v18 or later)
- npm

### Setup

```bash
npm install
```

### Run Locally

```bash
npm run dev
```

### Build

```bash
npm run build
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE.md) file for details.
