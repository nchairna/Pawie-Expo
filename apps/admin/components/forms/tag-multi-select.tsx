'use client';

import { useState, useMemo, useCallback } from 'react';
import { Check, X, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ProductTag } from '@/lib/types';

/**
 * TagMultiSelect Component
 *
 * A reusable multi-select component for selecting product tags with search functionality.
 * Works with react-hook-form and supports custom tag rendering.
 *
 * @example
 * ```tsx
 * // Basic usage
 * const [selectedTags, setSelectedTags] = useState<string[]>([]);
 *
 * <TagMultiSelect
 *   tags={allTags}
 *   value={selectedTags}
 *   onChange={setSelectedTags}
 * />
 *
 * // With react-hook-form
 * <FormField
 *   control={form.control}
 *   name="tag_ids"
 *   render={({ field }) => (
 *     <FormItem>
 *       <FormLabel>Tags</FormLabel>
 *       <FormControl>
 *         <TagMultiSelect
 *           tags={tags}
 *           value={field.value}
 *           onChange={field.onChange}
 *           disabled={saving}
 *         />
 *       </FormControl>
 *       <FormMessage />
 *     </FormItem>
 *   )}
 * />
 *
 * // With custom rendering
 * <TagMultiSelect
 *   tags={tags}
 *   value={selectedTagIds}
 *   onChange={setSelectedTagIds}
 *   renderTag={(tag, selected) => (
 *     <CustomTagButton tag={tag} selected={selected} />
 *   )}
 * />
 * ```
 */

export interface TagMultiSelectProps {
  /** Available tags to select from */
  tags: ProductTag[];
  /** Selected tag IDs */
  value?: string[];
  /** Callback when selection changes */
  onChange?: (tagIds: string[]) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Custom className for container */
  className?: string;
  /** Placeholder text for search input */
  searchPlaceholder?: string;
  /** Maximum number of tags that can be selected */
  maxTags?: number;
  /** Show search input */
  showSearch?: boolean;
  /** Empty state message */
  emptyMessage?: string;
  /** No results message */
  noResultsMessage?: string;
  /** Custom tag renderer */
  renderTag?: (tag: ProductTag, selected: boolean) => React.ReactNode;
}

export function TagMultiSelect({
  tags,
  value = [],
  onChange,
  disabled = false,
  className,
  searchPlaceholder = 'Search tags...',
  maxTags,
  showSearch = true,
  emptyMessage = 'No tags available. Create tags first.',
  noResultsMessage = 'No tags found matching your search.',
  renderTag,
}: TagMultiSelectProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter tags based on search query
  const filteredTags = useMemo(() => {
    if (!searchQuery) return tags;

    const query = searchQuery.toLowerCase().trim();
    return tags.filter(
      (tag) =>
        tag.name.toLowerCase().includes(query) ||
        tag.slug.toLowerCase().includes(query)
    );
  }, [tags, searchQuery]);

  // Get selected tags for display
  const selectedTags = useMemo(() => {
    return tags.filter((tag) => value.includes(tag.id));
  }, [tags, value]);

  // Handle tag selection toggle
  const handleToggle = useCallback(
    (tagId: string) => {
      if (disabled || !onChange) return;

      const isSelected = value.includes(tagId);

      if (isSelected) {
        // Remove tag
        onChange(value.filter((id) => id !== tagId));
      } else {
        // Add tag (check max limit)
        if (maxTags && value.length >= maxTags) {
          return; // Don't add if max reached
        }
        onChange([...value, tagId]);
      }
    },
    [value, onChange, disabled, maxTags]
  );

  // Handle remove tag from selected badges
  const handleRemove = useCallback(
    (tagId: string) => {
      if (disabled || !onChange) return;
      onChange(value.filter((id) => id !== tagId));
    },
    [value, onChange, disabled]
  );

  // Clear all selections
  const handleClearAll = useCallback(() => {
    if (disabled || !onChange) return;
    onChange([]);
  }, [onChange, disabled]);

  // Check if max tags reached
  const isMaxReached = maxTags !== undefined && maxTags > 0 && value.length >= maxTags;

  return (
    <div className={cn('space-y-3', className)}>
      {/* Search Input */}
      {showSearch && tags.length > 5 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={disabled}
            className="pl-9"
          />
        </div>
      )}

      {/* Selected Tags Display */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg border">
          <div className="flex items-center gap-2 flex-wrap flex-1">
            {selectedTags.map((tag) => (
              <Badge
                key={tag.id}
                variant="default"
                className="pl-2.5 pr-1.5 py-1 gap-1"
              >
                <span className="text-xs font-medium">{tag.name}</span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => handleRemove(tag.id)}
                    className="ml-1 rounded-sm hover:bg-primary-foreground/20 p-0.5 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </Badge>
            ))}
          </div>
          {!disabled && selectedTags.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              className="h-7 px-2 text-xs"
            >
              Clear all
            </Button>
          )}
        </div>
      )}

      {/* Max tags warning */}
      {isMaxReached && (
        <p className="text-sm text-muted-foreground">
          Maximum of {maxTags} tags reached
        </p>
      )}

      {/* Tag Selection Grid */}
      {tags.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed rounded-lg">
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </div>
      ) : filteredTags.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed rounded-lg">
          <p className="text-sm text-muted-foreground">{noResultsMessage}</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 p-4 border rounded-lg min-h-[60px]">
          {filteredTags.map((tag) => {
            const isSelected = value.includes(tag.id);

            // Use custom renderer if provided
            if (renderTag) {
              return (
                <div
                  key={tag.id}
                  onClick={() => handleToggle(tag.id)}
                  className="cursor-pointer"
                >
                  {renderTag(tag, isSelected)}
                </div>
              );
            }

            // Default renderer
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => handleToggle(tag.id)}
                disabled={disabled || (isMaxReached && !isSelected)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  isSelected
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'bg-background hover:bg-muted border-input',
                  disabled && 'opacity-50 cursor-not-allowed',
                  isMaxReached && !isSelected && 'opacity-40'
                )}
              >
                {isSelected && <Check className="h-3.5 w-3.5" />}
                <span className="font-medium">{tag.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Selection Counter */}
      {tags.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {value.length} of {tags.length} tags selected
          {maxTags && ` (max: ${maxTags})`}
        </p>
      )}
    </div>
  );
}
