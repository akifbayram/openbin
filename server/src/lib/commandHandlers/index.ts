import { handleDeleteArea, handleRenameArea, handleSetArea } from './areaHandlers.js';
import { handleCreateBin, handleDeleteBin, handleDuplicateBin, handleRestoreBin } from './binCrudHandlers.js';
import { handleUpdateBin } from './binUpdateHandler.js';
import { handleCheckoutItem, handleReturnItem } from './checkoutHandlers.js';
import { handleAddItems, handleModifyItem, handleRemoveItems, handleReorderItems, handleSetItemQuantity } from './itemHandlers.js';
import { handleSetColor, handleSetIcon, handleSetNotes } from './metadataHandlers.js';
import { handlePinBin, handleUnpinBin } from './pinHandlers.js';
import { handleAddTags, handleModifyTag, handleRemoveTags, handleSetTagColor } from './tagHandlers.js';
import type { ActionHandler } from './types.js';

// Each handler narrows CommandAction to its specific variant via Extract<>.
// The cast to ActionHandler is safe because commandExecutor dispatches by action.type.
export const handlers: Record<string, ActionHandler> = {
  add_items: handleAddItems as ActionHandler,
  remove_items: handleRemoveItems as ActionHandler,
  modify_item: handleModifyItem as ActionHandler,
  set_item_quantity: handleSetItemQuantity as ActionHandler,
  reorder_items: handleReorderItems as ActionHandler,
  create_bin: handleCreateBin as ActionHandler,
  delete_bin: handleDeleteBin as ActionHandler,
  restore_bin: handleRestoreBin as ActionHandler,
  duplicate_bin: handleDuplicateBin as ActionHandler,
  update_bin: handleUpdateBin as ActionHandler,
  add_tags: handleAddTags as ActionHandler,
  remove_tags: handleRemoveTags as ActionHandler,
  modify_tag: handleModifyTag as ActionHandler,
  set_tag_color: handleSetTagColor as ActionHandler,
  set_area: handleSetArea as ActionHandler,
  rename_area: handleRenameArea as ActionHandler,
  delete_area: handleDeleteArea as ActionHandler,
  set_notes: handleSetNotes as ActionHandler,
  set_icon: handleSetIcon as ActionHandler,
  set_color: handleSetColor as ActionHandler,
  pin_bin: handlePinBin as ActionHandler,
  unpin_bin: handleUnpinBin as ActionHandler,
  checkout_item: handleCheckoutItem as ActionHandler,
  return_item: handleReturnItem as ActionHandler,
};
