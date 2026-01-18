import { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, ScrollView, Platform } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

export interface ProductDetailSection {
  id: string;
  title: string;
  content: string; // HTML content
  sort_order: number;
}

interface ProductDetailAccordionProps {
  sections: ProductDetailSection[];
  title?: string; // Optional title for the accordion (e.g., "About This Item")
}

export function ProductDetailAccordion({
  sections,
  title = 'About This Item',
}: ProductDetailAccordionProps) {
  if (!sections || sections.length === 0) {
    return null;
  }

  // Sort sections by sort_order
  const sortedSections = [...sections].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <ThemedView style={styles.container}>
      {title && (
        <ThemedText type="defaultSemiBold" style={styles.title}>
          {title}
        </ThemedText>
      )}
      {sortedSections.map((section) => (
        <AccordionSection key={section.id} section={section} />
      ))}
    </ThemedView>
  );
}

interface AccordionSectionProps {
  section: ProductDetailSection;
}

function AccordionSection({ section }: AccordionSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [rotateAnim] = useState(new Animated.Value(0));

  const toggleSection = () => {
    const toValue = isOpen ? 0 : 1;
    Animated.timing(rotateAnim, {
      toValue,
      duration: 200,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
    setIsOpen(!isOpen);
  };

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  // Simple HTML to text converter for basic tags
  const renderContent = (html: string) => {
    if (!html) return null;

    // Remove HTML tags and decode entities (basic implementation)
    let text = html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<li>/gi, '• ')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, '') // Remove all remaining HTML tags
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();

    // Split by newlines and render as separate text elements
    const lines = text.split('\n').filter((line) => line.trim().length > 0);

    return (
      <View style={styles.contentContainer}>
        {lines.map((line, index) => {
          // Check if line starts with bullet (from <li>)
          const isListItem = line.startsWith('• ');
          const lineText = isListItem ? line.substring(2) : line;

          return (
            <ThemedText
              key={index}
              style={[styles.contentText, isListItem && styles.listItem]}>
              {isListItem ? '• ' : ''}
              {lineText}
            </ThemedText>
          );
        })}
      </View>
    );
  };

  return (
    <ThemedView style={styles.section}>
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={toggleSection}
        activeOpacity={0.7}>
        <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
          {section.title}
        </ThemedText>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <MaterialIcons name="expand-more" size={24} color="#666" />
        </Animated.View>
      </TouchableOpacity>

      {isOpen && (
        <View style={styles.sectionContent}>
          {section.content ? (
            <ScrollView
              style={styles.contentScrollView}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}>
              {renderContent(section.content)}
            </ScrollView>
          ) : (
            <ThemedText style={styles.emptyContent}>No content available.</ThemedText>
          )}
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    marginBottom: 16,
  },
  section: {
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 0,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 16,
  },
  sectionContent: {
    paddingBottom: 16,
    maxHeight: 300, // Limit height, allow scrolling for long content
  },
  contentScrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingVertical: 8,
  },
  contentText: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 8,
    opacity: 0.8,
  },
  listItem: {
    marginLeft: 16,
  },
  emptyContent: {
    fontSize: 14,
    opacity: 0.6,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
});
