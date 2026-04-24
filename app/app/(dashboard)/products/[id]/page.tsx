'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { PageHeader } from '@/components/PageHeader'

interface ProductVariant {
  id: string
  title: string
  sku: string | null
  barcode: string | null
  price: number | null
  compare_at_price: number | null
  currency: string | null
  inventory_quantity: number | null
  inventory_policy: string | null
  weight: number | null
  weight_unit: string | null
  position: number
  option_values: Record<string, string>
  image_url: string | null
}

interface ProductImage {
  url: string
  alt_text: string
  position: number
}

interface Product {
  id: string
  brand_id: string
  shopify_product_id: string
  title: string
  description_html: string | null
  vendor: string | null
  product_type: string | null
  status: string
  tags: string[] | null
  handle: string | null
  seo_title: string | null
  seo_description: string | null
  category_taxonomy: string | null
  featured_image_url: string | null
  images: ProductImage[]
  metafields: Record<string, { value: string; type: string }>
  shopify_created_at: string | null
  shopify_updated_at: string | null
  last_synced_at: string | null
  product_variants: ProductVariant[]
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  draft: 'bg-yellow-100 text-yellow-700',
  archived: 'bg-gray-100 text-gray-500',
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/products/${id}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error)
        else setProduct(data.product as Product)
      })
      .catch(() => setError('Failed to load product'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-6 w-48 bg-gray-100 rounded animate-pulse mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-100 rounded animate-pulse" />)}
        </div>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="p-6">
        <PageHeader title="Product" description="" />
        <div className="mt-6 bg-white rounded-lg border border-gray-200 px-5 py-10 text-center text-sm text-red-500">
          {error ?? 'Product not found'}
        </div>
      </div>
    )
  }

  const currency = product.product_variants[0]?.currency ?? 'AUD'
  const fmt = (n: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency }).format(n)
  const metafieldEntries = Object.entries(product.metafields ?? {})

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <button
            onClick={() => router.back()}
            className="text-xs text-gray-400 hover:text-gray-600 mb-2 flex items-center gap-1 transition-colors"
          >
            ← Products
          </button>
          <h1 className="text-xl font-semibold text-gray-900">{product.title}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[product.status] ?? 'bg-gray-100 text-gray-500'}`}>
              {product.status}
            </span>
            {product.vendor && <span className="text-xs text-gray-400">{product.vendor}</span>}
            {product.product_type && <span className="text-xs text-gray-400">· {product.product_type}</span>}
          </div>
        </div>
        <Link
          href={`/content-studio?product_id=${product.id}`}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors whitespace-nowrap"
        >
          Use in Content Studio
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Variants */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Variants ({product.product_variants.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wide">Title</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wide">SKU</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500 text-xs uppercase tracking-wide">Price</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500 text-xs uppercase tracking-wide">Compare at</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500 text-xs uppercase tracking-wide">Inventory</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {product.product_variants
                    .sort((a, b) => a.position - b.position)
                    .map(variant => (
                      <tr key={variant.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">
                          <div className="flex items-center gap-2">
                            {variant.image_url && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={variant.image_url} alt={variant.title} className="w-7 h-7 rounded object-cover border border-gray-100" />
                            )}
                            {variant.title}
                          </div>
                          {Object.keys(variant.option_values ?? {}).length > 0 && (
                            <div className="text-xs text-gray-400 mt-0.5">
                              {Object.entries(variant.option_values).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500">{variant.sku ?? '—'}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{variant.price != null ? fmt(variant.price) : '—'}</td>
                        <td className="px-4 py-3 text-right text-gray-400">{variant.compare_at_price != null ? fmt(variant.compare_at_price) : '—'}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{variant.inventory_quantity ?? '—'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Description */}
          {product.description_html && (
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">Description</h3>
              </div>
              <div
                className="px-5 py-5 prose prose-sm max-w-none text-gray-700"
                dangerouslySetInnerHTML={{ __html: product.description_html }}
              />
            </div>
          )}

          {/* Metafields */}
          {metafieldEntries.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">Metafields ({metafieldEntries.length})</h3>
              </div>
              <div className="px-5 py-5 space-y-3">
                {metafieldEntries.map(([key, meta]) => (
                  <div key={key}>
                    <div className="text-xs font-medium text-gray-500">{key}</div>
                    <div className="text-sm text-gray-900 mt-0.5 break-all">{meta.value}</div>
                    <div className="text-xs text-gray-400">{meta.type}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Images */}
          {product.images.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">Images ({product.images.length})</h3>
              </div>
              <div className="px-5 py-5 grid grid-cols-3 gap-2">
                {product.images.map((img, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={img.url}
                    alt={img.alt_text}
                    className="w-full aspect-square rounded object-cover border border-gray-100"
                  />
                ))}
              </div>
            </div>
          )}

          {/* SEO */}
          {(product.seo_title || product.seo_description) && (
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">SEO</h3>
              </div>
              <div className="px-5 py-5 space-y-3">
                {product.seo_title && (
                  <div>
                    <div className="text-xs text-gray-500">Title</div>
                    <div className="text-sm text-gray-900 mt-0.5">{product.seo_title}</div>
                  </div>
                )}
                {product.seo_description && (
                  <div>
                    <div className="text-xs text-gray-500">Description</div>
                    <div className="text-sm text-gray-700 mt-0.5">{product.seo_description}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Details */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Details</h3>
            </div>
            <div className="px-5 py-5 space-y-2 text-sm">
              {[
                ['Handle', product.handle],
                ['Category', product.category_taxonomy],
                ['Tags', product.tags?.join(', ')],
                ['Shopify ID', product.shopify_product_id?.replace('gid://shopify/Product/', '')],
                ['Last synced', product.last_synced_at ? new Date(product.last_synced_at).toLocaleString() : null],
              ].filter(([, v]) => v).map(([label, value]) => (
                <div key={String(label)} className="flex gap-3">
                  <span className="text-xs text-gray-400 w-24 shrink-0 pt-0.5">{label}</span>
                  <span className="text-gray-700 break-all">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
