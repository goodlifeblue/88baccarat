/**
 * Directus API 集成工具
 * 用于从 Directus CMS 获取内容和 SEO 元数据
 */

interface DirectusConfig {
  url: string;
  token?: string;
}

interface Article {
  id: string;
  title: string;
  slug: string;
  content: string;
  description: string;
  keywords: string;
  author: string;
  featured: boolean;
  publishedAt: string;
  updatedAt: string;
  image: string;
  imageAlt: string;
  category: string;
  relatedArticles?: string[];
  faq?: Array<{
    question: string;
    answer: string;
  }>;
  status: 'draft' | 'published' | 'archived';
}

interface SEOMeta {
  id: string;
  title: string;
  description: string;
  keywords: string;
  ogImage?: string;
  ogTitle?: string;
  ogDescription?: string;
  twitterCard?: string;
  canonicalUrl?: string;
}

class DirectusClient {
  private url: string;
  private token?: string;

  constructor(config: DirectusConfig) {
    this.url = config.url.replace(/\/$/, ''); // 移除末尾斜杠
    this.token = config.token;
  }

  /**
   * 获取 API 请求头
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  /**
   * 执行 API 请求
   */
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.url}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.getHeaders(),
          ...options.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`Directus API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.data || data;
    } catch (error) {
      console.error(`Failed to fetch from ${url}:`, error);
      throw error;
    }
  }

  /**
   * 获取所有已发布的文章
   */
  async getArticles(filter?: {
    category?: string;
    limit?: number;
    offset?: number;
    sort?: string;
  }): Promise<Article[]> {
    let query = '?filter[status][_eq]=published';

    if (filter?.category) {
      query += `&filter[category][_eq]=${filter.category}`;
    }

    if (filter?.limit) {
      query += `&limit=${filter.limit}`;
    }

    if (filter?.offset) {
      query += `&offset=${filter.offset}`;
    }

    if (filter?.sort) {
      query += `&sort=${filter.sort}`;
    }

    return this.request<Article[]>(`/items/articles${query}`);
  }

  /**
   * 获取单个文章（通过 slug）
   */
  async getArticleBySlug(slug: string): Promise<Article | null> {
    try {
      const articles = await this.request<Article[]>(
        `/items/articles?filter[slug][_eq]=${slug}&filter[status][_eq]=published&limit=1`
      );

      return articles.length > 0 ? articles[0] : null;
    } catch (error) {
      console.error(`Failed to fetch article with slug: ${slug}`, error);
      return null;
    }
  }

  /**
   * 获取文章 SEO 元数据
   */
  async getArticleSEO(articleId: string): Promise<SEOMeta | null> {
    try {
      return await this.request<SEOMeta>(`/items/article_seo/${articleId}`);
    } catch (error) {
      console.error(`Failed to fetch SEO data for article: ${articleId}`, error);
      return null;
    }
  }

  /**
   * 按类别获取文章
   */
  async getArticlesByCategory(category: string, limit: number = 10): Promise<Article[]> {
    return this.getArticles({
      category,
      limit,
      sort: '-publishedAt',
    });
  }

  /**
   * 搜索文章
   */
  async searchArticles(query: string, limit: number = 10): Promise<Article[]> {
    const encodedQuery = encodeURIComponent(query);
    return this.request<Article[]>(
      `/items/articles?filter[_or][0][title][_icontains]=${encodedQuery}&filter[_or][1][description][_icontains]=${encodedQuery}&filter[status][_eq]=published&limit=${limit}`
    );
  }

  /**
   * 获取相关文章
   */
  async getRelatedArticles(articleId: string, limit: number = 5): Promise<Article[]> {
    try {
      const article = await this.request<Article>(`/items/articles/${articleId}`);

      if (!article.relatedArticles || article.relatedArticles.length === 0) {
        return [];
      }

      // 获取相关文章 IDs 对应的文章
      const relatedIds = article.relatedArticles.slice(0, limit).join(',');
      return this.request<Article[]>(
        `/items/articles?filter[id][_in]=${relatedIds}&filter[status][_eq]=published`
      );
    } catch (error) {
      console.error(`Failed to fetch related articles for: ${articleId}`, error);
      return [];
    }
  }

  /**
   * 获取所有分类
   */
  async getCategories(): Promise<Array<{ id: string; name: string; slug: string }>> {
    return this.request('/items/categories');
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.request('/server/info');
      return true;
    } catch (error) {
      return false;
    }
  }
}

// 创建 Directus 客户端实例
const directusUrl = import.meta.env.DIRECTUS_URL || process.env.DIRECTUS_URL || 'http://localhost:8088';
const directusToken = import.meta.env.DIRECTUS_API_TOKEN || process.env.DIRECTUS_API_TOKEN;

export const directusClient = new DirectusClient({
  url: directusUrl,
  token: directusToken,
});

export type { Article, SEOMeta, DirectusConfig };
export { DirectusClient };
