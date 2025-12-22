import React from 'react';

import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import * as ImagePicker from 'expo-image-picker';
import { logger } from '../../lib/logger';

import { Icon } from './Icon'; 

interface ServiceImagePickerProps {
  images: string[];
  onImagesChange: (newImages: string[]) => void;
  uploading?: boolean;
  maxImages?: number;
}

export default function ServiceImagePicker({
  images,
  onImagesChange,
  uploading = false,
  maxImages = 4,
}: ServiceImagePickerProps) {
  const handlePickImage = async () => {
    if (images.length >= maxImages) {
      Alert.alert('Limite atingido', `Você pode adicionar no máximo ${maxImages} fotos.`);
      return;
    }

    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permissão necessária', 'Precisamos de permissão para acessar suas fotos!');
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const newImage = result.assets[0].uri;
        onImagesChange([...images, newImage]);
      }
    } catch (err) {
      logger.error('Erro ao selecionar imagem:', err);
      Alert.alert('Erro', 'Não foi possível selecionar a imagem.');
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    const updatedImages = images.filter((_, index) => index !== indexToRemove);
    onImagesChange(updatedImages);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Adicione fotos do seu serviço</Text>
      
      <View style={styles.photoRow}>
        {Array.from({ length: maxImages }).map((_, index) => {
          const imageUri = images[index];
          
          if (imageUri) {
            return (
              <View key={index} style={styles.photoBoxContainer}>
                <Image
                  source={{ uri: imageUri }}
                  style={styles.photoPreview}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  style={styles.removePhotoButton}
                  onPress={() => handleRemoveImage(index)}
                  activeOpacity={0.7}
                  disabled={uploading}
                >
                  <View style={styles.removePhotoBadge}>
                    <Text style={styles.removePhotoText}>×</Text>
                  </View>
                </TouchableOpacity>
              </View>
            );
          }

          return (
            <TouchableOpacity
              key={index}
              style={styles.photoBox}
              onPress={handlePickImage}
              activeOpacity={0.7}
              disabled={uploading || images.length >= maxImages}
            >
              {uploading ? (
                <ActivityIndicator color="#474747" />
              ) : (
                <View style={styles.circleButton}>
                  <Icon name="add" size={24} color="#FFFFFF" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    width: '100%',
  },
  label: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 12,
    color: '#000E3D',
    marginBottom: 4,
  },
  photoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  photoBox: {
    width: '48%',
    aspectRatio: 1,
    borderWidth: 1,
    borderColor: '#000000',
    borderStyle: 'dashed',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D9D9D9',
    marginBottom: 12,
  },
  photoBoxContainer: {
    width: '48%',
    aspectRatio: 1,
    position: 'relative',
    marginBottom: 12,
  },
  photoPreview: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -10,
    right: -10,
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  removePhotoBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E5102E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePhotoText: {
    color: '#FEFEFE',
    fontSize: 16,
    fontWeight: 'bold',
    lineHeight: 20,
  },
  circleButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#383838',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

