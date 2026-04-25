import { shopifyGraphQL } from './client'
import type { SupabaseClient } from '@supabase/supabase-js'

const PRODUCTS_QUERY = `
query GetProducts($first: Int!, $after: String) {
  products(first: $first, after: $after) {
    pageInfo {
      hasNextPage
      endCursor
    }
    nodes {
      id
      title
      descriptionHtml
      vendor
      productType
      status
      tags
      handle
      seo {
        title
        description
      }
      productCategory {
        productTaxonomyNode {
          fullName
        }
      }
      featuredMedia {
        ... on MediaImage {
          image {
            url
            altText
          }
        }
      }
      media(first: 10) {
        nodes {
          ... on MediaImage {
            image {
              url
              altText
            }
          }
        }
      }
      metafields(first: 20) {
        nodes {
          namespace
          key
          value
          type
        }
      }
      variants(first: 100) {
        nodes {
          id
          title
          sku
          price
          compareAtPrice
          inventoryPolicy
          position
          selectedOptions {
            name
            value
          }
          image {
            url
          }
          createdAt
          updatedAt
        }
      }
      createdAt
      updatedAt
    }
  }
}
`

interface ShopifyVariant {
  id: string
  title: string
  sku: string | null
  price: string
  compareAtPrice: string | null
  inventoryPolicy: string
  position: number
  selectedOptions: Array<{ name: string; value: string }>
  image: { url: string } | null
  createdAt: string
  updatedAt: string
}

interface ShopifyProduct {
  id: string
  title: string
  descriptionHtml: string
  vendor: string
  productType: string
  status: string
  tags: string[]
  handle: string
  seo: { title: string; description: string }
  productCategory: { productTaxonomyNode: { fullName: string } | null } | null
  featuredMedia: { image: { url: string; altText: string } } | null
  media: { nodes: Array<{ image?: { url: string; altText: string } }> }
  metafields: { nodes: Array<{ namespace: string; key: string; value: string; type: string }> }
  variants: { nodes: ShopifyVariant[] }
  createdAt: string
  updatedAt: string
}

interface ProductsQueryResponse {
  products: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null }
    nodes: ShopifyProduct[]
  }
}

export interface SyncResult {
  products_synced: number
  variants_synced: number
  products_archived: number
}

export async function syncProducts(
  supabase: SupabaseClient,
  brandId: string,
  shopDomain: string,
  accessToken: string,
): Promise<SyncResult> {
  const syncStart = new Date().toISOString()

  await supabase
    .from('shopify_connections')
    .update({ sync_status: 'syncing', sync_error: null })
    .eq('brand_id', brandId)
    .eq('shop_domain', shopDomain)

  try {
    const allProducts: ShopifyProduct[] = []
    let cursor: string | null = null
    let hasNextPage = true

    while (hasNextPage) {
      const result: import('./client').ShopifyGraphQLResponse<ProductsQueryResponse> = await shopifyGraphQL<ProductsQueryResponse>(
        shopDomain,
        accessToken,
        PRODUCTS_QUERY,
        { first: 50, after: cursor },
      )

      if (result.errors?.length) {
        throw new Error(result.errors[0].message)
      }

      const page = result.data!.products
      allProducts.push(...page.nodes)
      hasNextPage = page.pageInfo.hasNextPage
      cursor = page.pageInfo.endCursor
    }

    const syncedShopifyIds = new Set<string>()
    let productsUpserted = 0
    let variantsUpserted = 0

    for (const product of allProducts) {
      syncedShopifyIds.add(product.id)

      const images = product.media.nodes
        .filter(n => n.image)
        .map((n, i) => ({ url: n.image!.url, alt_text: n.image!.altText, position: i }))

      const metafields: Record<string, unknown> = {}
      for (const mf of product.metafields.nodes) {
        metafields[`${mf.namespace}.${mf.key}`] = { value: mf.value, type: mf.type }
      }

      const { data: upserted, error: productError } = await supabase
        .from('products')
        .upsert({
          brand_id: brandId,
          shopify_product_id: product.id,
          title: product.title,
          description_html: product.descriptionHtml,
          vendor: product.vendor,
          product_type: product.productType,
          status: product.status.toLowerCase(),
          tags: product.tags,
          handle: product.handle,
          seo_title: product.seo?.title ?? null,
          seo_description: product.seo?.description ?? null,
          category_taxonomy: product.productCategory?.productTaxonomyNode?.fullName ?? null,
          featured_image_url: product.featuredMedia?.image?.url ?? null,
          images,
          metafields,
          shopify_created_at: product.createdAt,
          shopify_updated_at: product.updatedAt,
          last_synced_at: syncStart,
          updated_at: syncStart,
        }, { onConflict: 'brand_id,shopify_product_id' })
        .select('id')
        .single()

      if (productError) throw new Error(`Product upsert failed: ${productError.message}`)
      productsUpserted++

      const existingVariants = await supabase
        .from('product_variants')
        .select('id, shopify_variant_id')
        .eq('product_id', upserted.id)

      const syncedVariantIds = new Set<string>()

      for (const variant of product.variants.nodes) {
        syncedVariantIds.add(variant.id)

        const optionValues: Record<string, string> = {}
        variant.selectedOptions.forEach(o => { optionValues[o.name] = o.value })

        const { error: variantError } = await supabase
          .from('product_variants')
          .upsert({
            brand_id: brandId,
            product_id: upserted.id,
            shopify_variant_id: variant.id,
            title: variant.title,
            sku: variant.sku,
            price: parseFloat(variant.price),
            compare_at_price: variant.compareAtPrice ? parseFloat(variant.compareAtPrice) : null,
            inventory_policy: variant.inventoryPolicy,
            position: variant.position,
            option_values: optionValues,
            image_url: variant.image?.url ?? null,
            shopify_created_at: variant.createdAt,
            shopify_updated_at: variant.updatedAt,
            last_synced_at: syncStart,
            updated_at: syncStart,
          }, { onConflict: 'brand_id,shopify_variant_id' })

        if (variantError) throw new Error(`Variant upsert failed: ${variantError.message}`)
        variantsUpserted++
      }

      // Hard-delete variants no longer in Shopify
      const staleVariantIds = (existingVariants.data ?? [])
        .filter(v => !syncedVariantIds.has(v.shopify_variant_id))
        .map(v => v.id)

      if (staleVariantIds.length > 0) {
        await supabase.from('product_variants').delete().in('id', staleVariantIds)
      }
    }

    // Soft-archive products no longer in Shopify
    const { data: existingProducts } = await supabase
      .from('products')
      .select('id, shopify_product_id, status')
      .eq('brand_id', brandId)
      .neq('status', 'archived')

    const staleProducts = (existingProducts ?? []).filter(p => !syncedShopifyIds.has(p.shopify_product_id))
    let productsArchived = 0

    if (staleProducts.length > 0) {
      await supabase
        .from('products')
        .update({ status: 'archived', updated_at: syncStart })
        .in('id', staleProducts.map(p => p.id))
      productsArchived = staleProducts.length
    }

    await supabase
      .from('shopify_connections')
      .update({ sync_status: 'success', last_sync_at: syncStart, sync_error: null })
      .eq('brand_id', brandId)
      .eq('shop_domain', shopDomain)

    return { products_synced: productsUpserted, variants_synced: variantsUpserted, products_archived: productsArchived }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await supabase
      .from('shopify_connections')
      .update({ sync_status: 'error', sync_error: message, last_sync_at: syncStart })
      .eq('brand_id', brandId)
      .eq('shop_domain', shopDomain)
    throw err
  }
}
