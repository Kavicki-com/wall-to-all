import { supabase } from './supabase';
import { sortCategories } from './categoryUtils';

export type Category = {
  id: number;
  name: string;
  created_at: string;
};

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

    const sortedCategories = sortCategories(data);
    
    return sortedCategories;
  } catch (error) {
    console.error('[lib/categories] Erro ao buscar categorias:', error);
    return [];
  }
};

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

