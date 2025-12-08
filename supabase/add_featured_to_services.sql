-- Adicionar campo is_featured na tabela services
-- Este campo permite marcar manualmente serviços como recomendados/destaque

ALTER TABLE services
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;

-- Criar índice para melhorar performance de queries que filtram por featured
CREATE INDEX IF NOT EXISTS idx_services_is_featured ON services(is_featured) WHERE is_featured = TRUE;

-- Comentário explicativo
COMMENT ON COLUMN services.is_featured IS 'Indica se o serviço é recomendado/destaque. Quando TRUE, o serviço aparece primeiro nos resultados de busca por categoria.';

