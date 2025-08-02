import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { formatCurrency } from '@baileys/utils'

type PropertyData = {
    propertyId: string
    propertyName: string
    totalTax: number
    totalRent: number
    taxRate: number
}

type MonthlyData = {
    month: string
    totalTax: number
    totalRent: number
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']

export const PropertyTaxChart = ({
    data,
    onPropertyClick
}: {
    data: PropertyData[]
    onPropertyClick?: (property: PropertyData) => void
}) => {
    const chartData = data.map(p => ({
        ...p,
        name: p.propertyName.length > 20 ? p.propertyName.substring(0, 20) + '...' : p.propertyName,
        tax: p.totalTax,
        rent: p.totalRent
    }))

    const handleClick = (data: any) => {
        if (onPropertyClick && data && data.payload) {
            const property = data.payload as typeof chartData[0]
            onPropertyClick({
                propertyId: property.propertyId,
                propertyName: property.propertyName,
                totalTax: property.tax,
                totalRent: property.rent,
                taxRate: property.taxRate
            })
        }
    }

    return (
        <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                    <YAxis tickFormatter={(value) => `$${value.toLocaleString()}`} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Bar dataKey="rent" fill="#3B82F6" name="Rent" cursor="pointer" onClick={handleClick} />
                    <Bar dataKey="tax" fill="#EF4444" name="Tax" cursor="pointer" onClick={handleClick} />
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
        month: m.month,
        tax: m.totalTax,
        rent: m.totalRent,
        taxRate: m.totalRent > 0 ? (m.totalTax / m.totalRent) * 100 : 0
    }))

    const handleClick = (data: any) => {
        if (onMonthClick && data && data.activeLabel) {
            onMonthClick(data.activeLabel)
        }
    }

    return (
        <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} onClick={handleClick}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis yAxisId="left" tickFormatter={(value) => `$${value.toLocaleString()}`} />
                    <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => `${value.toFixed(1)}%`} />
                    <Tooltip
                        formatter={(value, name) => {
                            if (name === 'Tax Rate') return `${Number(value).toFixed(2)}%`
                            return formatCurrency(Number(value))
                        }}
                    />
                    <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="rent"
                        stroke="#3B82F6"
                        name="Rent"
                        strokeWidth={2}
                        cursor="pointer"
                        activeDot={{ r: 6 }}
                    />
                    <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="tax"
                        stroke="#EF4444"
                        name="Tax"
                        strokeWidth={2}
                        cursor="pointer"
                        activeDot={{ r: 6 }}
                    />
                    <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="taxRate"
                        stroke="#10B981"
                        name="Tax Rate"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        cursor="pointer"
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
        name: p.propertyName,
        value: p.totalTax,
        color: COLORS[index % COLORS.length],
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
                        label={({ percent }) => percent != null ? `${(percent * 100).toFixed(0)}%` : ''}
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
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                </PieChart>
            </ResponsiveContainer>
        </div>
    )
}
