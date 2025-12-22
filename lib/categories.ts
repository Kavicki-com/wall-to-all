import { supabase } from './supabase';
import { sortCategories, Category as CategoryUtilType } from './categoryUtils';
import { logger } from '../lib/logger';
import { Database } from '../supabase/types';

export type Category = Database['public']['Tables']['categories']['Row'];

export const fetchCategories = async (): Promise<Category[]> => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      logger.error('[lib/categories] Erro ao buscar categorias:', error);
      return [];
    }

    if (!data || data.length === 0) {
      logger.warn('[lib/categories] Nenhuma categoria encontrada na tabela categories');
      return [];
    }

    const sortedCategories = sortCategories(data as CategoryUtilType[]);
    
    return sortedCategories as Category[];
  } catch (error) {
    logger.error('[lib/categories] Erro ao buscar categorias:', error);
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

    return data;
  } catch (error) {
    logger.error('Erro ao buscar categoria por nome:', error);
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

    return data;
  } catch (error) {
    logger.error('Erro ao buscar categoria por ID:', error);
    return null;
  }
};

