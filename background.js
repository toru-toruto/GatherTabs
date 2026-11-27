// ツールバーのアイコン（またはショートカット）で、他のウインドウのタブを
// クリックしたウインドウへすべて移動する。タブは閉じず、空になった
// 移動元ウインドウは Chrome が自動で閉じる。

const NO_GROUP = -1;

let running = false;

chrome.action.onClicked.addListener(async (tab) => {
  if (running) return;
  running = true;
  try {
    await gatherInto(tab.windowId);
  } catch (e) {
    console.error("Gather Tabs:", e);
  } finally {
    running = false;
  }
});

async function gatherInto(targetWindowId) {
  const target = await chrome.windows.get(targetWindowId);
  const windows = await chrome.windows.getAll({
    populate: true,
    windowTypes: ["normal"],
  });

  // 通常ウインドウとシークレットウインドウの間ではタブを移動できないので、
  // 集め先と同じ種類のウインドウだけを対象にする。
  const sources = windows.filter(
    (w) => w.id !== target.id && w.incognito === target.incognito
  );

  for (const win of sources) {
    const movedGroups = new Set();

    for (const tab of win.tabs) {
      try {
        if (tab.groupId !== NO_GROUP) {
          // タブグループは 1 つずつ動かすと解除されるので、グループごと移動する。
          if (!movedGroups.has(tab.groupId)) {
            movedGroups.add(tab.groupId);
            await chrome.tabGroups.move(tab.groupId, {
              windowId: target.id,
              index: -1,
            });
          }
          continue;
        }

        await chrome.tabs.move(tab.id, { windowId: target.id, index: -1 });

        // ウインドウをまたぐ移動では固定が外れるので付け直す。
        if (tab.pinned) {
          await chrome.tabs.update(tab.id, { pinned: true });
        }
      } catch (e) {
        // ドラッグ中のタブなど、動かせないものは飛ばして続行する。
        console.warn("Gather Tabs: タブを移動できませんでした", tab.id, e);
      }
    }
  }

  await chrome.windows.update(target.id, { focused: true });
}
