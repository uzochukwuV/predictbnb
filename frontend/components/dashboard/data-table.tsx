"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChevronRight, ExternalLink, MoreVertical } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@radix-ui/react-dropdown-menu"

interface Column<T> {
  key: keyof T | string
  label: string
  render?: (item: T) => React.ReactNode
  className?: string
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  onRowClick?: (item: T) => void
  emptyMessage?: string
  loading?: boolean
}

export function DataTable<T extends { id: string | number }>({
  data,
  columns,
  onRowClick,
  emptyMessage = "No data available",
  loading = false,
}: DataTableProps<T>) {
  const [hoveredRow, setHoveredRow] = useState<string | number | null>(null)

  if (loading) {
    return (
      <div className="border border-border/30">
        <div className="p-8 text-center">
          <motion.div
            className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full mx-auto"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
          <p className="font-mono text-xs text-muted-foreground mt-4">Loading...</p>
        </div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="border border-border/30">
        <div className="p-8 text-center">
          <p className="font-mono text-sm text-muted-foreground">{emptyMessage}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="border border-border/30 overflow-hidden">
      {/* Header */}
      <div className="grid gap-px bg-border/30" style={{ gridTemplateColumns: `repeat(${columns.length}, 1fr)` }}>
        {columns.map((column) => (
          <div key={String(column.key)} className={cn("bg-background p-4", column.className)}>
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {column.label}
            </span>
          </div>
        ))}
      </div>

      {/* Rows */}
      <AnimatePresence>
        {data.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ delay: index * 0.05 }}
            onMouseEnter={() => setHoveredRow(item.id)}
            onMouseLeave={() => setHoveredRow(null)}
            onClick={() => onRowClick?.(item)}
            className={cn(
              "grid gap-px bg-border/30 cursor-pointer transition-colors duration-200",
              hoveredRow === item.id && "bg-accent/5"
            )}
            style={{ gridTemplateColumns: `repeat(${columns.length}, 1fr)` }}
          >
            {columns.map((column) => (
              <div
                key={`${item.id}-${String(column.key)}`}
                className={cn(
                  "bg-background p-4 flex items-center",
                  hoveredRow === item.id && "bg-accent/5",
                  column.className
                )}
              >
                {column.render ? (
                  column.render(item)
                ) : (
                  <span className="font-mono text-sm text-foreground">
                    {String((item as Record<string, unknown>)[column.key as string] ?? "-")}
                  </span>
                )}
              </div>
            ))}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export function SimpleList<T extends { id: string | number }>({
  items,
  renderItem,
  onItemClick,
  emptyMessage = "No items",
  className,
}: {
  items: T[]
  renderItem: (item: T, index: number) => React.ReactNode
  onItemClick?: (item: T) => void
  emptyMessage?: string
  className?: string
}) {
  if (items.length === 0) {
    return (
      <div className="p-8 text-center border border-border/30">
        <p className="font-mono text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className={cn("space-y-2", className)}>
      {items.map((item, index) => (
        <motion.div
          key={item.id}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.05 }}
          onClick={() => onItemClick?.(item)}
          className="cursor-pointer"
        >
          {renderItem(item, index)}
        </motion.div>
      ))}
    </div>
  )
}

export function GameListItem({
  name,
  type,
  queries,
  revenue,
  status,
  onClick,
}: {
  name: string
  type: string
  queries: number
  revenue: string
  status: "active" | "inactive" | "pending"
  onClick?: () => void
}) {
  const statusVariant = {
    active: "success" as const,
    inactive: "secondary" as const,
    pending: "warning" as const,
  }

  return (
    <motion.div
      whileHover={{ x: 4 }}
      className="p-4 border border-border/30 hover:border-accent/50 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="font-mono text-sm text-foreground font-medium">{name}</h3>
            <Badge variant={statusVariant[status]}>{status}</Badge>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-mono text-xs text-muted-foreground">{type}</span>
            <span className="font-mono text-xs text-muted-foreground">{queries.toLocaleString()} queries</span>
            <span className="font-mono text-xs text-accent">{revenue} BNB</span>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </div>
    </motion.div>
  )
}
