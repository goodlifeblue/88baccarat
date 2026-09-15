/**
 * Astro 从 Directus 获取内容的示例
 * 这个模块封装了常见的数据获取操作
 */

import { directusClient } from './directus';

/**
 * 获取所有文章用于首页或列表页面
 */
export async function getAllArticles(limit = 10, category?: string) {
  try {
    return await directusClient.getArticles({
      limit,
      category,
      sort: '-publishedAt',
    });
  } catch (error) {
    console.error('Failed to fetch all articles:', error);
    return [];
  }
}

/**
 * 获取单个文章用于详情页面
 */
export async function getArticleBySlug(slug: string) {
  try {
    return await directusClient.getArticleBySlug(slug);
  } catch (error) {
    console.error(`Failed to fetch article with slug ${slug}:`, error);
    return null;
  }
}

/**
 * 获取分类内的文章
 */
export async function getArticlesByCategory(category: string, limit = 10) {
  try {
    return await directusClient.getArticlesByCategory(category, limit);
  } catch (error) {
    console.error(`Failed to fetch articles for category ${category}:`, error);
    return [];
  }
}

/**
 * 搜索文章
 */
export async function searchArticles(query: string, limit = 10) {
  try {
    return await directusClient.searchArticles(query, limit);
  } catch (error) {
    console.error(`Failed to search articles with query "${query}":`, error);
    return [];
  }
}

/**
 * 获取首页精选文章
 */
export async function getFeaturedArticles(limit = 3) {
  try {
    const articles = await directusClient.getArticles({
      limit,
    });
    return articles.filter(a => a.featured);
  } catch (error) {
    console.error('Failed to fetch featured articles:', error);
    return [];
  }
}

/**
 * 获取最新发布的文章
 */
export async function getLatestArticles(limit = 5) {
  try {
    return await directusClient.getArticles({
      limit,
      sort: '-publishedAt',
    });
  } catch (error) {
    console.error('Failed to fetch latest articles:', error);
    return [];
  }
}

/**
 * 获取所有分类（用于导航等）
 */
export async function getAllCategories() {
  try {
    return await directusClient.getCategories();
  } catch (error) {
    console.error('Failed to fetch categories:', error);
    return [];
  }
}
