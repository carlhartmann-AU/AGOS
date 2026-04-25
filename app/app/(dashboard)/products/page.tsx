'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useBrand } from '@/context/BrandContext'
import { PageHeader } from '@/components/PageHeader'

interface ProductVariant {
  id: string
  title: string
  sku: string | null
  price: number | null
  currency: string | null
  inventory_quantity: number | null
  position: number
}

interface Product {
  id: string
  shopify_product_id: string
  title: string
  status: string
  vendor: string | null
  product_type: string | null
  tags: string[] | null
  featured_image_url: string | null
  last_synced_at: string | null
  product_variants: ProductVariant[] | null
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  draft: 'bg-yellow-100 text-yellow-700',
  archived: 'bg-gray-100 text-gray-500',
}

function priceRange(variants: ProductVariant[]): string {
  const prices = variants.map(v => v.price ?? 0).filter(p => p > 0)
  if (!prices.length) return '—'
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const currency = variants[0]?.currency ?? 'AUD'
  const fmt = (n: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency }).format(n)
  return min === max ? fmt(min) : `${fmt(min)} – ${fmt(max)}`
}

function totalInventory(variants: ProductVariant[]): number {
  return variants.reduce((s, v) => s + (v.inventory_quantity ?? 0), 0)
}

export default function ProductsPage() {
  const { activeBrand } = useBrand()
  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(0)
  const limit = 50

  const fetchProducts = useCallback(async () => {
    if (!activeBrand) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        brand_id: activeBrand.brand_id,
        limit: String(limit),
        offset: String(page * limit),
      })
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)

      const res = await fetch(`/api/products?${params}`, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json() as { products: Product[]; total: number }
        setProducts(data.products)
        setTotal(data.total)
      }
    } finally {
      setLoading(false)
    }
  }, [activeBrand?.brand_id, search, statusFilter, page]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  // Reset to page 0 when filters change
  useEffect(() => {
    setPage(0)
  }, [search, statusFilter])

  if (!activeBrand) {
    return (
      <div className="p-6">
        <PageHeader title="Products" description="Synced Shopify product catalog." />
        <div className="mt-6 bg-white rounded-lg border border-gray-200 px-5 py-10 text-center text-sm text-gray-400">
          Select a brand to view products.
        </div>
      </div>
    )
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="p-6">
      <PageHeader title="Products" description="Synced Shopify product catalog." />

      <div className="mt-6 flex flex-col gap-4">
        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text"
            placeholder="Search products…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="block w-64 rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="block rounded-md border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
          <span className="ml-auto text-sm text-gray-400">{loading ? '—' : `${total} product${total !== 1 ? 's' : ''}`}</span>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="px-5 py-10 text-center text-sm text-gray-400">Loading…</div>
          ) : products.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-gray-400">
              {search || statusFilter ? 'No products match your filters.' : 'No products synced yet. Connect Shopify and run a sync from Settings → Integrations.'}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wide w-12"></th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wide">Title</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 text-xs uppercase tracking-wide">Variants</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 text-xs uppercase tracking-wide">Price range</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 text-xs uppercase tracking-wide">Inventory</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 text-xs uppercase tracking-wide">Last synced</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {products.map(product => (
                  <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      {product.featured_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.featured_image_url}
                          alt={product.title}
                          className="w-9 h-9 rounded object-cover border border-gray-100"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded bg-gray-100 flex items-center justify-center text-gray-300">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/products/${product.id}`} className="font-medium text-gray-900 hover:text-gray-600 transition-colors">
                        {product.title}
                      </Link>
                      {product.vendor && <div className="text-xs text-gray-400 mt-0.5">{product.vendor}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[product.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {product.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{(product.product_variants ?? []).length}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{priceRange(product.product_variants ?? [])}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{totalInventory(product.product_variants ?? [])}</td>
                    <td className="px-4 py-3 text-right text-gray-400 text-xs">
                      {product.last_synced_at ? new Date(product.last_synced_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">
              Showing {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => p - 1)}
                disabled={page === 0}
                className="px-3 py-1.5 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= totalPages - 1}
                className="px-3 py-1.5 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
