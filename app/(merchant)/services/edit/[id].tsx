import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../../../lib/supabase';
import { IconBack } from '../../../../lib/icons';
import { fetchCategories, type Category } from '../../../../lib/categories';

type Service = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category_id: number | null;
  duration_minutes: number | null;
  photos: string[] | string | null;
};

const EditServiceScreen: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [durationMinutes, setDurationMinutes] = useState('');
  const [images, setImages] = useState<string[]>([]);

  useEffect(() => {
    loadCategories();
    loadService();
    requestImagePermission();
  }, [params.id]);

  const loadCategories = async () => {
    const categoriesData = await fetchCategories();
    setCategories(categoriesData);
  };

  const loadService = async () => {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.back();
        return;
      }

      // Buscar business_profile do lojista
      const { data: businessData } = await supabase
        .from('business_profiles')
        .select('id')
        .eq('owner_id', user.id)
        .single();

      if (!businessData) {
        router.back();
        return;
      }

      setBusinessId(businessData.id);

      // Buscar serviço
      const { data: serviceData, error } = await supabase
        .from('services')
        .select('*')
        .eq('id', params.id)
        .eq('business_id', businessData.id)
        .single();

      if (error || !serviceData) {
        console.error('Erro ao buscar serviço:', error);
        Alert.alert('Erro', 'Serviço não encontrado.');
        router.back();
        return;
      }

      setService(serviceData as Service);
      setName(serviceData.name);
      setDescription(serviceData.description || '');
      setPrice(serviceData.price.toString().replace('.', ','));
      setSelectedCategoryId(serviceData.category_id || null);
      setDurationMinutes(serviceData.duration_minutes?.toString() || '');

      // Processar imagens
      let imagesArray: string[] = [];
      if (serviceData.photos) {
        if (typeof serviceData.photos === 'string') {
          try {
            imagesArray = JSON.parse(serviceData.photos);
          } catch {
            imagesArray = [serviceData.photos];
          }
        } else if (Array.isArray(serviceData.photos)) {
          imagesArray = serviceData.photos;
        }
      }
      setImages(imagesArray);
    } catch (error) {
      console.error('Erro ao carregar serviço:', error);
      Alert.alert('Erro', 'Ocorreu um erro ao carregar o serviço.');
    } finally {
      setLoading(false);
    }
  };

  const requestImagePermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Precisamos de permissão para acessar suas fotos.');
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets) {
        const newImages = result.assets.map((asset) => asset.uri);
        setImages([...images, ...newImages]);
      }
    } catch (error) {
      console.error('Erro ao selecionar imagem:', error);
      Alert.alert('Erro', 'Não foi possível selecionar a imagem.');
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const uploadNewImages = async (): Promise<string[]> => {
    // Separar imagens novas (URIs locais) das existentes (URLs)
    const newImages = images.filter((img) => img.startsWith('file://') || img.startsWith('content://'));
    const existingImages = images.filter((img) => img.startsWith('http://') || img.startsWith('https://'));

    if (newImages.length === 0) return existingImages;

    const uploadedUrls: string[] = [...existingImages];

    for (const imageUri of newImages) {
      try {
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
        const filePath = `services/${businessId}/${fileName}`;

        const response = await fetch(imageUri);
        const blob = await response.blob();

        const { data, error } = await supabase.storage
          .from('service-images')
          .upload(filePath, blob, {
            contentType: 'image/jpeg',
          });

        if (error) {
          console.error('Erro ao fazer upload:', error);
          continue;
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from('service-images').getPublicUrl(filePath);

        uploadedUrls.push(publicUrl);
      } catch (error) {
        console.error('Erro ao processar imagem:', error);
      }
    }

    return uploadedUrls;
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Erro', 'O nome do serviço é obrigatório.');
      return;
    }

    if (!price.trim()) {
      Alert.alert('Erro', 'O preço é obrigatório.');
      return;
    }

    const priceValue = parseFloat(price.replace(',', '.'));
    if (isNaN(priceValue) || priceValue <= 0) {
      Alert.alert('Erro', 'Preço inválido.');
      return;
    }

    if (!service || !businessId) {
      Alert.alert('Erro', 'Dados incompletos.');
      return;
    }

    try {
      setSaving(true);

      // Upload de novas imagens
      const imageUrls = await uploadNewImages();

      // Atualizar serviço
      const serviceData: any = {
        name: name.trim(),
        description: description.trim() || null,
        price: priceValue,
        category_id: selectedCategoryId || null,
        duration_minutes: durationMinutes ? parseInt(durationMinutes) : null,
        photos: imageUrls.length > 0 ? JSON.stringify(imageUrls) : null,
      };

      const { error } = await supabase
        .from('services')
        .update(serviceData)
        .eq('id', service.id)
        .eq('business_id', businessId);

      if (error) {
        console.error('Erro ao atualizar serviço:', error);
        Alert.alert('Erro', 'Não foi possível atualizar o serviço.');
        return;
      }

      Alert.alert('Sucesso', 'Serviço atualizado com sucesso!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Erro ao atualizar serviço:', error);
      Alert.alert('Erro', 'Ocorreu um erro ao atualizar o serviço.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Excluir Serviço',
      'Tem certeza que deseja excluir este serviço? Esta ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              const { error } = await supabase
                .from('services')
                .delete()
                .eq('id', service!.id)
                .eq('business_id', businessId!);

              if (error) {
                console.error('Erro ao excluir serviço:', error);
                Alert.alert('Erro', 'Não foi possível excluir o serviço.');
                return;
              }

              Alert.alert('Sucesso', 'Serviço excluído com sucesso!', [
                { text: 'OK', onPress: () => router.back() },
              ]);
            } catch (error) {
              console.error('Erro ao excluir serviço:', error);
              Alert.alert('Erro', 'Ocorreu um erro ao excluir o serviço.');
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E5102E" />
      </View>
    );
  }

  if (!service) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <IconBack size={24} color="#000E3D" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Editar Serviço</Text>
          </View>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Serviço não encontrado.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <IconBack size={24} color="#000E3D" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Editar Serviço</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Name */}
        <View style={styles.field}>
          <Text style={styles.label}>Nome do Serviço *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Corte de cabelo"
            placeholderTextColor="#9E9E9E"
            value={name}
            onChangeText={setName}
          />
        </View>

        {/* Description */}
        <View style={styles.field}>
          <Text style={styles.label}>Descrição</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Descreva o serviço..."
            placeholderTextColor="#9E9E9E"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Price */}
        <View style={styles.field}>
          <Text style={styles.label}>Preço (R$) *</Text>
          <TextInput
            style={styles.input}
            placeholder="0,00"
            placeholderTextColor="#9E9E9E"
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
          />
        </View>

        {/* Category */}
        <View style={styles.field}>
          <Text style={styles.label}>Categoria</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categories}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryChip, selectedCategoryId === cat.id && styles.categoryChipSelected]}
                onPress={() => setSelectedCategoryId(selectedCategoryId === cat.id ? null : cat.id)}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    selectedCategoryId === cat.id && styles.categoryChipTextSelected,
                  ]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Duration */}
        <View style={styles.field}>
          <Text style={styles.label}>Duração (minutos)</Text>
          <TextInput
            style={styles.input}
            placeholder="60"
            placeholderTextColor="#9E9E9E"
            value={durationMinutes}
            onChangeText={setDurationMinutes}
            keyboardType="number-pad"
          />
        </View>

        {/* Images */}
        <View style={styles.field}>
          <Text style={styles.label}>Fotos</Text>
          <View style={styles.imagesContainer}>
            {images.map((uri, index) => (
              <View key={index} style={styles.imageWrapper}>
                <Image source={{ uri }} style={styles.image} resizeMode="cover" />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => removeImage(index)}
                >
                  <Text style={styles.removeImageText}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
            {images.length < 5 && (
              <TouchableOpacity style={styles.addImageButton} onPress={pickImage}>
                <Text style={styles.addImageText}>+</Text>
                <Text style={styles.addImageLabel}>Adicionar</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.deleteButton, saving && styles.deleteButtonDisabled]}
          onPress={handleDelete}
          disabled={saving}
        >
          <Text style={styles.deleteButtonText}>Excluir Serviço</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.submitButton, saving && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FEFEFE" />
          ) : (
            <Text style={styles.submitButtonText}>Salvar Alterações</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default EditServiceScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: '#FEFEFE',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 100,
  },
  field: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FEFEFE',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    padding: 16,
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#0F0F0F',
  },
  textArea: {
    minHeight: 100,
  },
  categories: {
    marginTop: 8,
  },
  categoryChip: {
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  categoryChipSelected: {
    backgroundColor: '#D6E0FF',
    borderColor: '#000E3D',
  },
  categoryChipText: {
    fontSize: 14,
    fontFamily: 'Montserrat_500Medium',
    color: '#474747',
  },
  categoryChipTextSelected: {
    color: '#000E3D',
    fontFamily: 'Montserrat_700Bold',
  },
  imagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  imageWrapper: {
    width: 100,
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  removeImageButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E5102E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeImageText: {
    color: '#FEFEFE',
    fontSize: 18,
    fontFamily: 'Montserrat_700Bold',
    lineHeight: 20,
  },
  addImageButton: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  addImageText: {
    fontSize: 32,
    fontFamily: 'Montserrat_400Regular',
    color: '#474747',
  },
  addImageLabel: {
    fontSize: 12,
    fontFamily: 'Montserrat_400Regular',
    color: '#474747',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FEFEFE',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    gap: 12,
  },
  deleteButton: {
    backgroundColor: '#FEFEFE',
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5102E',
  },
  deleteButtonDisabled: {
    opacity: 0.6,
  },
  deleteButtonText: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#E5102E',
  },
  submitButton: {
    backgroundColor: '#E5102E',
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#FEFEFE',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#474747',
    textAlign: 'center',
  },
});




