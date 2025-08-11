import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { formatCurrency, formatPercentage, calculatePercentage, ensureNumber } from '@baileys/utils'
import { METRIC_COLORS, getChartColor } from '@/lib/theme'

type PropertyData = {
    propertyId: string
    propertyName: string
    totalTax: number
    totalRent: number
    bookingCount: number
    taxRate: number
}

type MonthlyData = {
    month: string
    totalTax: number
    totalRent: number
    bookingCount: number
}

const formatMonthLabel = (month: string) => {
    const [year, monthNum] = month.split('-')
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${monthNames[parseInt(monthNum) - 1]} ${year.slice(2)}`
}

export const PropertyTaxChart = ({
    data,
    onPropertyClick
}: {
    data: PropertyData[]
    onPropertyClick?: (property: PropertyData) => void
}) => {
    const chartData = data.map(p => ({
        ...p,
        name: p.propertyName.length > 15 ? p.propertyName.substring(0, 12) + '...' : p.propertyName,
        fullName: p.propertyName,
        tax: p.totalTax,
        rent: p.totalRent,
        bookings: p.bookingCount
    }))

    const handleClick = (data: any) => {
        if (onPropertyClick && data && data.payload) {
            const property = data.payload
            onPropertyClick({
                propertyId: property.propertyId,
                propertyName: property.fullName,
                totalTax: property.tax,
                totalRent: property.rent,
                bookingCount: property.bookings,
                taxRate: property.taxRate
            })
        }
    }

    return (
        <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    data={chartData}
                    margin={{ left: 10, right: 10, top: 10, bottom: 60 }}
                >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                        dataKey="name"
                        angle={-45}
                        textAnchor="end"
                        interval={0}
                        height={80}
                    />
                    <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                    <Tooltip
                        formatter={(value) => formatCurrency(ensureNumber(value))}
                        content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                const data = payload[0].payload
                                return (
                                    <div className="bg-white p-3 border rounded-sm shadow-lg">
                                        <p className="font-medium">{data.fullName}</p>
                                        <p className="text-sm">Rent: {formatCurrency(data.rent)}</p>
                                        <p className="text-sm">Tax: {formatCurrency(data.tax)}</p>
                                        <p className="text-sm text-gray-600">
                                            Rate: {formatPercentage(calculatePercentage(data.tax, data.rent), 2)}
                                        </p>
                                    </div>
                                )
                            }
                            return null
                        }}
                    />
                    <Legend />
                    <Bar
                        dataKey="rent"
                        fill={METRIC_COLORS.revenue}
                        name="Rent"
                        cursor="pointer"
                        onClick={handleClick}
                    />
                    <Bar
                        dataKey="tax"
                        fill={METRIC_COLORS.tax}
                        name="Tax"
                        cursor="pointer"
                        onClick={handleClick}
                    />
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}

export const MonthlyTrendChart = ({
    data,
    onMonthClick
}: {
    data: MonthlyData[]
    onMonthClick?: (month: string) => void
}) => {
    const chartData = data.map(m => ({
        ...m,
        displayMonth: formatMonthLabel(m.month),
        tax: m.totalTax,
        rent: m.totalRent,
        bookings: m.bookingCount,
        taxRate: calculatePercentage(m.totalTax, m.totalRent)
    }))

    const handleClick = (data: any) => {
        if (onMonthClick && data && data.activeLabel) {
            const monthData = chartData.find(m => m.displayMonth === data.activeLabel)
            if (monthData) {
                onMonthClick(monthData.month)
            }
        }
    }

    return (
        <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart
                    data={chartData}
                    onClick={handleClick}
                    margin={{ left: 10, right: 10, top: 10, bottom: 20 }}
                >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                        dataKey="displayMonth"
                        angle={-45}
                        textAnchor="end"
                        height={60}
                    />
                    <YAxis yAxisId="left" tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                    <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => formatPercentage(value, 0)} />
                    <Tooltip
                        formatter={(value, name) => {
                            if (name === 'Tax Rate') return formatPercentage(ensureNumber(value), 2)
                            return formatCurrency(ensureNumber(value))
                        }}
                        labelFormatter={(label) => label}
                    />
                    <Legend />
                    <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="rent"
                        stroke={METRIC_COLORS.revenue}
                        name="Rent"
                        strokeWidth={2}
                        cursor="pointer"
                        dot={{ fill: METRIC_COLORS.revenue, r: 4 }}
                        activeDot={{ r: 6 }}
                    />
                    <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="tax"
                        stroke={METRIC_COLORS.tax}
                        name="Tax"
                        strokeWidth={2}
                        cursor="pointer"
                        dot={{ fill: METRIC_COLORS.tax, r: 4 }}
                        activeDot={{ r: 6 }}
                    />
                    <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="taxRate"
                        stroke={METRIC_COLORS.bookings}
                        name="Tax Rate"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        cursor="pointer"
                        dot={{ fill: METRIC_COLORS.bookings, r: 3 }}
                        activeDot={{ r: 6 }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    )
}

export const PropertyDistributionChart = ({
    data,
    onPropertyClick
}: {
    data: PropertyData[]
    onPropertyClick?: (property: PropertyData) => void
}) => {
    const pieData = data.map((p, index) => ({
        name: p.propertyName.length > 20 ? p.propertyName.substring(0, 17) + '...' : p.propertyName,
        fullName: p.propertyName,
        value: p.totalTax,
        color: getChartColor(index),
        propertyData: p
    }))

    const handleClick = (data: any) => {
        if (onPropertyClick && data) {
            onPropertyClick(data.propertyData)
        }
    }

    return (
        <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) =>
                            `${name} ${formatPercentage((percent || 0) * 100, 0)}`
                        }
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        cursor="pointer"
                        onClick={handleClick}
                    >
                        {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                    </Pie>
                    <Tooltip
                        formatter={(value) => formatCurrency(ensureNumber(value))}
                        content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                const data = payload[0].payload
                                return (
                                    <div className="bg-white p-3 border rounded-sm shadow-lg">
                                        <p className="font-medium">{data.fullName}</p>
                                        <p className="text-sm">Tax: {formatCurrency(data.value)}</p>
                                    </div>
                                )
                            }
                            return null
                        }}
                    />
                </PieChart>
            </ResponsiveContainer>
        </div>
    )
}
