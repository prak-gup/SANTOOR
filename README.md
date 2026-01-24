# Santoor Cross-Media TV Optimizer

A React + TypeScript dashboard for analyzing Wipro Santoor TV campaign performance across three Indian markets: Uttar Pradesh, Maharashtra, and Karnataka.

## Features

- **Multi-Market Analysis**: Switch between UP, Maharashtra, and Karnataka markets
- **Dynamic SCR Selection**: Sub-Category Regions change based on selected market
- **Performance Metrics**: Total channels, Santoor presence, competitor gaps, and optimization indices
- **Advanced Filtering**: Filter by genre and search by channel name
- **Sortable Tables**: Click any column to sort data (ascending/descending)
- **Color-Coded Insights**: Visual indicators for performance gaps and competitive positioning
- **CSV Export**: Export filtered data for further analysis
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices

## Tech Stack

- **React 18** - Modern UI library
- **TypeScript** - Type-safe development
- **Vite** - Fast development and build tool
- **Tailwind CSS** - Utility-first styling
- **Recharts** - Data visualization (available for future use)

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
# Navigate to project directory
cd santoor-optimizer

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173/`

### Build for Production

```bash
npm run build
```

## Project Structure

```
santoor-optimizer/
├── src/
│   ├── components/          # React components
│   │   ├── MarketSelector.tsx
│   │   ├── SCRSelector.tsx
│   │   ├── SummaryCards.tsx
│   │   ├── ChannelTable.tsx
│   │   └── Filters.tsx
│   ├── data/               # Embedded data
│   │   └── santoor_multimarket_data.json
│   ├── types/              # TypeScript interfaces
│   │   └── index.ts
│   ├── utils/              # Helper functions
│   │   └── helpers.ts
│   ├── App.tsx             # Main application component
│   ├── main.tsx            # Application entry point
│   └── index.css           # Global styles
├── tailwind.config.js      # Tailwind configuration
└── package.json
```

## How to Use

1. **Select a Market**: Choose from UP, Maharashtra, or Karnataka using the dropdown
2. **Select an SCR**: Click on any Sub-Category Region button (options change per market)
3. **View Summary**: See key metrics like total channels, Santoor presence, and gaps
4. **Analyze Table**: Review detailed channel-wise performance data
5. **Filter Data**: Use genre filter or search to focus on specific channels
6. **Sort Columns**: Click any column header to sort the table
7. **Export Data**: Click "Export CSV" to download filtered results

## Market-Specific Features

### UP & Maharashtra (Reach Optimization)
- Competitor data: Godrej and Lux
- Optimization metric: Reach percentage
- Columns: Channel, Genre, Santoor %, Godrej %, Lux %, Gap, Indices, Status

### Karnataka (ATC Optimization)
- Competitor data: Lifebuoy and Mysore Sandal
- Optimization metric: ATC Index
- Additional column: ATC Index
- Columns: Channel, Genre, Santoor %, Lifebuoy %, M.Sandal %, ATC Index, Gap, Indices, Status

## Color Coding

### Gap Colors
- **Green**: Positive gap (Santoor ahead)
- **Red**: Negative gap (Santoor behind)

### Index vs Competition
- **Green (>150)**: DOMINANT - Strong market position
- **Light Green (100-150)**: LEADING - Ahead of competition
- **Yellow (80-100)**: CLOSE - Near parity
- **Orange (50-80)**: BEHIND - Falling behind
- **Red (<50)**: CRITICAL - Significant gap

## Data

The application uses pre-processed data embedded in `src/data/santoor_multimarket_data.json` (1.6 MB). No backend or API calls are required.

## License

Copyright © 2026 Wipro Santoor Campaign Team

## Support

For questions or issues, contact the Wipro Santoor campaign team.
