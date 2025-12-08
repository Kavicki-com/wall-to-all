import { supabase } from './supabase';
import { sortCategories } from './categoryUtils';

export type Category = {
  id: number;
  name: string;
  created_at: string;
};

/**
 * Busca todas as categorias da tabela categories
 * Retorna ordenadas alfabeticamente, mas "outros" sempre por último
 */
export const fetchCategories = async (): Promise<Category[]> => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('[lib/categories] Erro ao buscar categorias:', error);
      return [];
    }

    if (!data || data.length === 0) {
      console.warn('[lib/categories] Nenhuma categoria encontrada na tabela categories');
      return [];
    }

    // Ordenar: alfabética, mas "outros" sempre por último
    const sortedCategories = sortCategories(data);
    
    return sortedCategories;
  } catch (error) {
    console.error('[lib/categories] Erro ao buscar categorias:', error);
    return [];
  }
};

/**
 * Busca uma categoria pelo nome (case-insensitive)
 */
export const findCategoryByName = async (name: string): Promise<Category | null> => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .ilike('name', name)
      .single();

    if (error || !data) {
      return null;
    }

    return data as Category;
  } catch (error) {
    console.error('Erro ao buscar categoria por nome:', error);
    return null;
  }
};

/**
 * Busca uma categoria pelo ID
 */
export const findCategoryById = async (id: number): Promise<Category | null> => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return null;
    }

    return data as Category;
  } catch (error) {
    console.error('Erro ao buscar categoria por ID:', error);
    return null;
  }
};

