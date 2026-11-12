// Algorithm catalogue: pseudocode (written for this project), complexity, JavaScript and
// Python reference implementations (original code), and the Learn page text.
//
// COMPLEXITY VALUES: every row below was checked against the standard textbook definitions
// listed in the README ("Sources checked"). Where a value depends on an assumption - Shell
// sort's gap sequence, counting sort's range k, quick sort's pivot rule - the assumption is
// stated in `notes` instead of being hidden behind a single symbol.

export interface Complexity {
	best: string;
	average: string;
	worst: string;
	space: string;
	stable: boolean | null;
	inPlace: boolean | null;
	notes: string;
}

export interface AlgoEntry {
	id: string;
	family: 'sorting' | 'searching' | 'pathfinding' | 'graph';
	name: string;
	tagline: string;
	pseudocode: string[];
	complexity: Complexity;
	js: string;
	py: string;
	learn: {
		how: string;
		worked: string;
		when: string;
		strengths: string[];
		weaknesses: string[];
		mistakes: string[];
	};
}

export const CATALOG: Record<string, AlgoEntry> = {
	// ----------------------------------------------------------------- SORTING
	bubble: {
		id: 'bubble',
		family: 'sorting',
		name: 'Bubble sort',
		tagline: 'Repeatedly swap neighbours until a whole pass changes nothing.',
		pseudocode: [
			'procedure bubbleSort(A)',
			'  n <- length(A)',
			'  for i from 0 to n - 2',
			'    swapped <- false',
			'    for j from 0 to n - 2 - i',
			'      if A[j] > A[j + 1] then swap A[j], A[j + 1]; swapped <- true',
			'    end for',
			'    mark A[n - 1 - i] as final',
			'    if not swapped then stop early',
			'  end for',
			'end procedure'
		],
		complexity: {
			best: 'O(n)',
			average: 'O(n^2)',
			worst: 'O(n^2)',
			space: 'O(1)',
			stable: true,
			inPlace: true,
			notes: 'The O(n) best case needs the early-exit flag; without it every version is O(n^2) even on sorted input. One pass over a sorted array of n makes exactly n-1 comparisons.'
		},
		js: `function bubbleSort(a) {
  const out = [...a];
  for (let i = 0; i < out.length - 1; i++) {
    let swapped = false;
    for (let j = 0; j < out.length - 1 - i; j++) {
      if (out[j] > out[j + 1]) {
        [out[j], out[j + 1]] = [out[j + 1], out[j]];
        swapped = true;
      }
    }
    if (!swapped) break; // already sorted
  }
  return out;
}`,
		py: `def bubble_sort(a):
    out = list(a)
    for i in range(len(out) - 1):
        swapped = False
        for j in range(len(out) - 1 - i):
            if out[j] > out[j + 1]:
                out[j], out[j + 1] = out[j + 1], out[j]
                swapped = True
        if not swapped:
            break  # already sorted
    return out`,
		learn: {
			how: 'Bubble sort walks the list from left to right and swaps any pair of neighbours that is out of order. Each complete pass pushes the largest remaining value to the right-hand end, like a bubble rising, so after the first pass the last slot is final, after the second pass the last two are final, and so on. The pass range therefore shrinks by one each time. If a whole pass performs no swaps at all, the list cannot contain any out-of-order neighbours, which means it is already sorted and the algorithm can stop immediately.',
			worked: 'Sorting [5, 1, 4, 2]: compare 5 and 1 (swap, giving [1, 5, 4, 2]), compare 5 and 4 (swap, giving [1, 4, 5, 2]), compare 5 and 2 (swap, giving [1, 4, 2, 5]). The 5 is now final. Second pass: compare 1 and 4 (keep), compare 4 and 2 (swap, giving [1, 2, 4, 5]). The 4 is now final. Third pass: compare 1 and 2 (keep) with no swaps, so the early exit triggers and the sort ends with 4 comparisons in the last two passes rather than grinding on.',
			when: 'Use it to teach the idea of comparison sorting, or on a list you already believe is almost sorted and you want the cheap O(n) confirmation pass. It is almost never the right choice for real data.',
			strengths: [
				'Very short and easy to reason about.',
				'Stable, so equal values keep their original order.',
				'Sorts in place with no extra array.',
				'With the early-exit flag it detects an already-sorted list in a single pass.'
			],
			weaknesses: [
				'Quadratic on average and in the worst case, so it is unusable on large input.',
				'Performs far more writes than selection sort for the same data.',
				'Each swap only moves a value one position, so a value that belongs at the other end needs many passes.'
			],
			mistakes: [
				'Forgetting the early-exit flag and then claiming an O(n) best case.',
				'Shrinking the inner loop bound incorrectly and re-comparing values that are already final.',
				'Confusing the swap condition: using >= instead of > performs pointless swaps and destroys stability.'
			]
		}
	},

	selection: {
		id: 'selection',
		family: 'sorting',
		name: 'Selection sort',
		tagline: 'Find the smallest remaining value and put it in place with one swap.',
		pseudocode: [
			'procedure selectionSort(A)',
			'  n <- length(A)',
			'  for i from 0 to n - 2',
			'    min <- i',
			'    for j from i + 1 to n - 1',
			'      if A[j] < A[min] then min <- j',
			'    swap A[i], A[min]',
			'    mark A[i] as final',
			'  end for',
			'end procedure'
		],
		complexity: {
			best: 'O(n^2)',
			average: 'O(n^2)',
			worst: 'O(n^2)',
			space: 'O(1)',
			stable: false,
			inPlace: true,
			notes: 'Always makes exactly n(n-1)/2 comparisons regardless of the input order - sorted input is no cheaper. It makes at most n-1 swaps, which is the fewest of any quadratic sort.'
		},
		js: `function selectionSort(a) {
  const out = [...a];
  for (let i = 0; i < out.length - 1; i++) {
    let min = i;
    for (let j = i + 1; j < out.length; j++) {
      if (out[j] < out[min]) min = j;
    }
    if (min !== i) [out[i], out[min]] = [out[min], out[i]];
  }
  return out;
}`,
		py: `def selection_sort(a):
    out = list(a)
    for i in range(len(out) - 1):
        lo = i
        for j in range(i + 1, len(out)):
            if out[j] < out[lo]:
                lo = j
        if lo != i:
            out[i], out[lo] = out[lo], out[i]
    return out`,
		learn: {
			how: 'Selection sort splits the list into a sorted prefix on the left and an unsorted rest on the right. On each round it scans the whole unsorted part to find the smallest value, then swaps that value into the first unsorted slot, growing the sorted prefix by one. The scan is unavoidable: the algorithm cannot know which value is smallest without looking at all of them, which is why sorted input costs exactly as much as reversed input.',
			worked: 'Sorting [4, 2, 7, 1]: scan all four and find the smallest is 1 at index 3, swap it with index 0 to get [1, 2, 7, 4]. Scan indices 1 to 3 and find the smallest is 2, already at index 1, so no swap is needed. Scan indices 2 to 3 and find the smallest is 4 at index 3, swap to get [1, 2, 4, 7]. Three rounds, six comparisons, two swaps.',
			when: 'Use it when writing to memory is expensive and comparisons are cheap, because it performs the minimum number of swaps among the simple quadratic sorts.',
			strengths: [
				'At most n-1 swaps, which matters when a write is far costlier than a read.',
				'Sorts in place with constant extra memory.',
				'Its running time is completely predictable and does not depend on the input.'
			],
			weaknesses: [
				'Always quadratic; it cannot take advantage of nearly-sorted input.',
				'Not stable, because the long-range swap can jump one equal value over another.',
				'No early exit is possible.'
			],
			mistakes: [
				'Claiming an O(n) best case by confusing it with insertion sort.',
				'Describing it as stable; the swap of a distant minimum breaks the order of equal keys.',
				'Starting the inner scan at index 0 instead of i + 1 and re-scanning the finished prefix.'
			]
		}
	},

	insertion: {
		id: 'insertion',
		family: 'sorting',
		name: 'Insertion sort',
		tagline: 'Grow a sorted prefix by sliding each new value back into place.',
		pseudocode: [
			'procedure insertionSort(A)',
			'  mark A[0] as sorted',
			'  for i from 1 to length(A) - 1',
			'    key <- A[i]',
			'    j <- i - 1',
			'    while j >= 0 and A[j] > key',
			'      A[j + 1] <- A[j]',
			'      j <- j - 1',
			'    A[j + 1] <- key',
			'  end for',
			'end procedure'
		],
		complexity: {
			best: 'O(n)',
			average: 'O(n^2)',
			worst: 'O(n^2)',
			space: 'O(1)',
			stable: true,
			inPlace: true,
			notes: 'Best case is sorted input, where each new value needs a single comparison, giving exactly n-1 comparisons. Running time is O(n + d) where d is the number of inversions, which is why it is excellent on nearly-sorted data.'
		},
		js: `function insertionSort(a) {
  const out = [...a];
  for (let i = 1; i < out.length; i++) {
    const key = out[i];
    let j = i - 1;
    while (j >= 0 && out[j] > key) {
      out[j + 1] = out[j];
      j--;
    }
    out[j + 1] = key;
  }
  return out;
}`,
		py: `def insertion_sort(a):
    out = list(a)
    for i in range(1, len(out)):
        key = out[i]
        j = i - 1
        while j >= 0 and out[j] > key:
            out[j + 1] = out[j]
            j -= 1
        out[j + 1] = key
    return out`,
		learn: {
			how: 'Insertion sort keeps a sorted region at the front of the list and extends it one value at a time. It lifts the next value out, then slides every larger value in the sorted region one place to the right until it finds the gap where the lifted value belongs, and drops it in. Because the loop stops as soon as it meets a value that is not greater than the key, a value that is already in the right place costs only one comparison - this is exactly how people sort a hand of playing cards.',
			worked: 'Sorting [3, 1, 4, 2]: the prefix is [3]. Lift 1, compare with 3 (greater, so 3 slides right), the prefix becomes [1, 3]. Lift 4, compare with 3 (not greater, stop immediately), the prefix becomes [1, 3, 4] at the cost of one comparison. Lift 2, compare with 4 (slides), compare with 3 (slides), compare with 1 (stop), giving [1, 2, 3, 4]. Six comparisons in total.',
			when: 'Use it for small lists, for nearly-sorted data, and as the base case inside a faster divide-and-conquer sort. Real library sorts switch to insertion sort below roughly 10 to 30 elements.',
			strengths: [
				'Linear time on sorted or nearly-sorted input.',
				'Stable and in place.',
				'Online: it can sort a stream, inserting each value as it arrives.',
				'Very low constant factor, so it beats clever sorts on tiny inputs.'
			],
			weaknesses: [
				'Quadratic on reversed or random input.',
				'Each shift moves data by only one position.'
			],
			mistakes: [
				'Using >= in the while condition, which shifts equal values and destroys stability.',
				'Writing the key back at index j rather than j + 1 after the loop exits.',
				'Forgetting the j >= 0 guard and reading before the start of the array.'
			]
		}
	},

	merge: {
		id: 'merge',
		family: 'sorting',
		name: 'Merge sort',
		tagline: 'Split in half, sort each half, then merge the two sorted runs.',
		pseudocode: [
			'procedure mergeSort(A, lo, hi)',
			'  if lo >= hi then return',
			'  mid <- floor((lo + hi) / 2)',
			'  mergeSort(A, lo, mid)',
			'  mergeSort(A, mid + 1, hi)',
			'  copy A[lo..hi] into aux',
			'  while both runs have values',
			'    take the smaller front value (left run wins ties)',
			'  copy any remaining values',
			'  mark A[lo..hi] as a sorted run',
			'end procedure'
		],
		complexity: {
			best: 'O(n log n)',
			average: 'O(n log n)',
			worst: 'O(n log n)',
			space: 'O(n)',
			stable: true,
			inPlace: false,
			notes: 'The O(n) extra space is the auxiliary array used by the merge. Recursion adds O(log n) stack frames. The comparison count is bounded above by n*ceil(log2 n) - 2^ceil(log2 n) + 1.'
		},
		js: `function mergeSort(a) {
  if (a.length <= 1) return [...a];
  const mid = a.length >> 1;
  const left = mergeSort(a.slice(0, mid));
  const right = mergeSort(a.slice(mid));
  const out = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    // <= keeps the sort stable: ties take the left run first.
    out.push(left[i] <= right[j] ? left[i++] : right[j++]);
  }
  while (i < left.length) out.push(left[i++]);
  while (j < right.length) out.push(right[j++]);
  return out;
}`,
		py: `def merge_sort(a):
    if len(a) <= 1:
        return list(a)
    mid = len(a) // 2
    left = merge_sort(a[:mid])
    right = merge_sort(a[mid:])
    out = []
    i = j = 0
    while i < len(left) and j < len(right):
        # <= keeps the sort stable: ties take the left run first.
        if left[i] <= right[j]:
            out.append(left[i])
            i += 1
        else:
            out.append(right[j])
            j += 1
    out.extend(left[i:])
    out.extend(right[j:])
    return out`,
		learn: {
			how: 'Merge sort is divide and conquer. It halves the list until every piece holds a single value, which is trivially sorted, then repeatedly merges two sorted pieces into one larger sorted piece. The merge is the real work: it walks a pointer along each run and repeatedly takes whichever front value is smaller. Because the halving depth is log n and each merge level touches every element once, the total work is n log n on every input, with no bad cases.',
			worked: 'Sorting [3, 1, 4, 2]: split into [3, 1] and [4, 2]; split again into [3], [1], [4], [2]. Merge [3] and [1] by comparing 3 with 1 and taking 1 first, giving [1, 3]. Merge [4] and [2], giving [2, 4]. Final merge of [1, 3] and [2, 4]: compare 1 and 2 (take 1), compare 3 and 2 (take 2), compare 3 and 4 (take 3), then copy the remaining 4, giving [1, 2, 3, 4].',
			when: 'Use it when you need a guaranteed n log n bound, when stability matters, when sorting linked lists (where the merge needs no extra space), and for external sorting of data too large for memory.',
			strengths: [
				'n log n in the best, average and worst case alike.',
				'Stable when the merge breaks ties toward the left run.',
				'Merging reads sequentially, which suits linked lists and on-disk data.',
				'Parallelises cleanly, because the two halves are independent.'
			],
			weaknesses: [
				'Needs O(n) extra memory for the array version.',
				'Slower than quick sort in practice on arrays because of the copying.',
				'Does not take advantage of existing order (unless upgraded to a run-detecting variant).'
			],
			mistakes: [
				'Using < instead of <= in the merge, which silently makes the sort unstable.',
				'Computing the midpoint as (lo + hi) / 2 in a fixed-width integer language, where it can overflow; use lo + (hi - lo) / 2.',
				'Allocating a fresh auxiliary array inside every merge instead of reusing one.'
			]
		}
	},

	quick: {
		id: 'quick',
		family: 'sorting',
		name: 'Quick sort',
		tagline: 'Partition around a pivot, then sort the two sides.',
		pseudocode: [
			'procedure quickSort(A, lo, hi)',
			'  if lo >= hi then return',
			'  choose a pivot and move it to A[hi]',
			'  store <- lo',
			'  for j from lo to hi - 1',
			'    if A[j] < pivot then swap A[store], A[j]; store <- store + 1',
			'  end for',
			'  swap A[store], A[hi]',
			'  mark A[store] as final',
			'  quickSort(A, lo, store - 1)',
			'  quickSort(A, store + 1, hi)',
			'end procedure'
		],
		complexity: {
			best: 'O(n log n)',
			average: 'O(n log n)',
			worst: 'O(n^2)',
			space: 'O(log n)',
			stable: false,
			inPlace: true,
			notes: 'The O(n^2) worst case happens when the pivot is consistently extreme - for example the first-or-last rule on already-sorted input. Median-of-three or a randomised pivot makes that case very unlikely but does not remove it. The O(log n) space is recursion stack depth, which becomes O(n) in the worst case unless the smaller side is recursed first.'
		},
		js: `function quickSort(a, lo = 0, hi = a.length - 1, out = [...a]) {
  if (lo >= hi) return out;
  const pivot = out[hi];
  let store = lo;
  for (let j = lo; j < hi; j++) {
    if (out[j] < pivot) {
      [out[store], out[j]] = [out[j], out[store]];
      store++;
    }
  }
  [out[store], out[hi]] = [out[hi], out[store]];
  quickSort(out, lo, store - 1, out);
  quickSort(out, store + 1, hi, out);
  return out;
}`,
		py: `def quick_sort(a, lo=0, hi=None, out=None):
    if out is None:
        out = list(a)
    if hi is None:
        hi = len(out) - 1
    if lo >= hi:
        return out
    pivot = out[hi]
    store = lo
    for j in range(lo, hi):
        if out[j] < pivot:
            out[store], out[j] = out[j], out[store]
            store += 1
    out[store], out[hi] = out[hi], out[store]
    quick_sort(a, lo, store - 1, out)
    quick_sort(a, store + 1, hi, out)
    return out`,
		learn: {
			how: 'Quick sort picks one value as the pivot and rearranges the range so that everything smaller than the pivot sits to its left and everything larger sits to its right. After that single partition pass the pivot is in its final position for good, and the algorithm recurses into the two sides. Unlike merge sort it does no merging, which is why it is in place and fast in practice; the price is that a badly chosen pivot can split the range into one empty side and one almost-full side, degrading to quadratic time.',
			worked: 'Sorting [3, 6, 2, 5] with the last element as the pivot (5): scan 3 (less than 5, keep at position 0, store becomes 1), scan 6 (not less, leave it), scan 2 (less, swap with position 1 giving [3, 2, 6, 5], store becomes 2). Swap the pivot into position 2, giving [3, 2, 5, 6]. The 5 is final. Recurse on [3, 2], which partitions to [2, 3], and on [6], which is a single element.',
			when: 'Use it as the default in-memory array sort when stability is not required. It is what most standard libraries use (usually hardened as introsort, which falls back to heap sort if the recursion gets too deep).',
			strengths: [
				'Fastest comparison sort in practice on arrays, thanks to good cache behaviour.',
				'Sorts in place.',
				'The pivot rule can be tuned - median-of-three and random pivots both avoid the common bad cases.'
			],
			weaknesses: [
				'Quadratic worst case.',
				'Not stable.',
				'Naive implementations degrade badly on sorted input and on arrays with many duplicates (unless three-way partitioning is used).'
			],
			mistakes: [
				'Always taking the first or last element as the pivot, then being surprised that sorted input is quadratic.',
				'Including the pivot in the partition loop and swapping it away from the end.',
				'Recursing into the larger side first, which can use O(n) stack.',
				'Treating a random pivot as a worst-case guarantee rather than a probabilistic one.'
			]
		}
	},

	heap: {
		id: 'heap',
		family: 'sorting',
		name: 'Heap sort',
		tagline: 'Build a max-heap, then repeatedly move the root to the end.',
		pseudocode: [
			'procedure heapSort(A)',
			'  for i from floor(n/2) - 1 down to 0',
			'    siftDown(A, i, n - 1)',
			'  for end from n - 1 down to 1',
			'    swap A[0], A[end]; mark A[end] as final',
			'    siftDown(A, 0, end - 1)',
			'procedure siftDown(A, root, last)',
			'  while root has a child within last',
			'    pick the larger child',
			'    if the child is larger than the root then swap and continue',
			'    else stop',
			'end procedure'
		],
		complexity: {
			best: 'O(n log n)',
			average: 'O(n log n)',
			worst: 'O(n log n)',
			space: 'O(1)',
			stable: false,
			inPlace: true,
			notes: 'Building the heap bottom-up is O(n), not O(n log n); the n log n total comes from the n extract-max steps. Best case is also n log n for the standard algorithm (a sorted input is not cheaper).'
		},
		js: `function heapSort(a) {
  const out = [...a];
  const siftDown = (root, last) => {
    while (true) {
      const left = 2 * root + 1;
      if (left > last) return;
      let largest = root;
      if (out[largest] < out[left]) largest = left;
      const right = left + 1;
      if (right <= last && out[largest] < out[right]) largest = right;
      if (largest === root) return;
      [out[root], out[largest]] = [out[largest], out[root]];
      root = largest;
    }
  };
  for (let i = (out.length >> 1) - 1; i >= 0; i--) siftDown(i, out.length - 1);
  for (let end = out.length - 1; end > 0; end--) {
    [out[0], out[end]] = [out[end], out[0]];
    siftDown(0, end - 1);
  }
  return out;
}`,
		py: `def heap_sort(a):
    out = list(a)

    def sift_down(root, last):
        while True:
            left = 2 * root + 1
            if left > last:
                return
            largest = root
            if out[largest] < out[left]:
                largest = left
            right = left + 1
            if right <= last and out[largest] < out[right]:
                largest = right
            if largest == root:
                return
            out[root], out[largest] = out[largest], out[root]
            root = largest

    for i in range(len(out) // 2 - 1, -1, -1):
        sift_down(i, len(out) - 1)
    for end in range(len(out) - 1, 0, -1):
        out[0], out[end] = out[end], out[0]
        sift_down(0, end - 1)
    return out`,
		learn: {
			how: 'Heap sort treats the array as a complete binary tree where the children of index i live at 2i+1 and 2i+2. First it rearranges the array into a max-heap, in which every parent is at least as large as its children, by sifting each internal node down starting from the last one. The root is then guaranteed to hold the largest value, so the algorithm swaps it with the final slot, shrinks the heap by one, and sifts the new root down to restore the heap property. Repeating that extracts the values in descending order into the back of the array, which leaves it sorted ascending.',
			worked: 'Sorting [3, 1, 4]: heapify from index 0 - compare 3 with children 1 and 4, the largest is 4, so swap to get [4, 1, 3]. Extract: swap the root 4 with the last slot to get [3, 1, 4] and mark 4 final; sift the new root 3 against child 1, which needs no swap. Extract again: swap 3 and 1 to get [1, 3, 4] and mark 3 final. The 1 is left and the array is sorted.',
			when: 'Use it when you need a guaranteed n log n bound with constant extra memory, or as the fallback inside introsort when quick sort recurses too deeply.',
			strengths: [
				'n log n in the worst case with only O(1) extra space.',
				'No bad input: the bound does not depend on the data.',
				'The same heap structure doubles as a priority queue.'
			],
			weaknesses: [
				'Not stable.',
				'Poor cache locality, because sifting jumps across the array, so it is usually slower than quick sort in practice.',
				'Cannot exploit existing order.'
			],
			mistakes: [
				'Building the heap top-down one insertion at a time, which costs n log n instead of n.',
				'Starting heapify at index n-1 instead of floor(n/2)-1 and wasting work on leaves.',
				'Forgetting to shrink the heap bound after each extraction, which lets finished values be sifted back in.',
				'Building a min-heap and then expecting ascending output.'
			]
		}
	},

	shell: {
		id: 'shell',
		family: 'sorting',
		name: 'Shell sort',
		tagline: 'Insertion sort on widely spaced elements, then on closer ones.',
		pseudocode: [
			'procedure shellSort(A)',
			'  gap <- floor(n / 2)',
			'  while gap > 0',
			'    for i from gap to n - 1',
			'      key <- A[i]; j <- i',
			'      while j >= gap and A[j - gap] > key',
			'        A[j] <- A[j - gap]; j <- j - gap',
			'      A[j] <- key',
			'    gap <- floor(gap / 2)',
			'  end while',
			'end procedure'
		],
		complexity: {
			best: 'O(n log n)',
			average: 'depends on the gap sequence',
			worst: 'O(n^2) with the halving sequence',
			space: 'O(1)',
			stable: false,
			inPlace: true,
			notes: 'AlgoLens uses Shell\'s original halving sequence (n/2, n/4, ... 1), whose worst case is O(n^2). Better sequences change the bound: Hibbard gives O(n^(3/2)) and Sedgewick gives O(n^(4/3)). The average case has no simple closed form for most sequences, which is why it is reported as sequence-dependent rather than with a made-up symbol.'
		},
		js: `function shellSort(a) {
  const out = [...a];
  for (let gap = out.length >> 1; gap > 0; gap >>= 1) {
    for (let i = gap; i < out.length; i++) {
      const key = out[i];
      let j = i;
      while (j >= gap && out[j - gap] > key) {
        out[j] = out[j - gap];
        j -= gap;
      }
      out[j] = key;
    }
  }
  return out;
}`,
		py: `def shell_sort(a):
    out = list(a)
    gap = len(out) // 2
    while gap > 0:
        for i in range(gap, len(out)):
            key = out[i]
            j = i
            while j >= gap and out[j - gap] > key:
                out[j] = out[j - gap]
                j -= gap
            out[j] = key
        gap //= 2
    return out`,
		learn: {
			how: 'Shell sort is insertion sort run on interleaved subsequences. With a gap of g it sorts the elements at positions 0, g, 2g, ... among themselves, then 1, 1+g, 1+2g, ... and so on, which lets a value travel g positions in a single move instead of one. Each pass reduces the gap, and the final pass with gap 1 is an ordinary insertion sort - but by then the array is nearly sorted, so that last pass is cheap. The trick is that the earlier wide passes destroy the long-distance disorder that makes plain insertion sort slow.',
			worked: 'Sorting [9, 1, 8, 2] with gap 2: compare positions 0 and 2 (9 against 8) and swap to get [8, 1, 9, 2]; compare positions 1 and 3 (1 against 2), already in order. Now gap 1: the array [8, 1, 9, 2] needs 1 moved before 8 and 2 moved before 9, giving [1, 2, 8, 9]. The wide pass removed one long-distance inversion, so the final pass had less to do.',
			when: 'Use it for medium-sized arrays in environments where code size and constant memory matter more than the last word in asymptotic performance - embedded systems and standard-library fallbacks are the classic cases.',
			strengths: [
				'Much faster than plain insertion sort while staying almost as short.',
				'In place with O(1) extra memory.',
				'Adapts well to partially ordered data.'
			],
			weaknesses: [
				'Not stable, because the wide-gap moves jump over equal values.',
				'Performance depends entirely on the gap sequence, and the analysis is genuinely hard.',
				'Loses to merge and quick sort on large arrays.'
			],
			mistakes: [
				'Quoting a single tidy complexity for "Shell sort" without naming the gap sequence it belongs to.',
				'Using a gap sequence whose terms share factors, so some positions are never compared with others until the final pass.',
				'Forgetting that the loop must start at i = gap, not i = 0.'
			]
		}
	},

	counting: {
		id: 'counting',
		family: 'sorting',
		name: 'Counting sort',
		tagline: 'Count how often each value occurs, then write them back in order.',
		pseudocode: [
			'procedure countingSort(A)',
			'  find min and max of A',
			'  counts <- array of zeros, size max - min + 1',
			'  for each value v in A: counts[v - min] <- counts[v - min] + 1',
			'  out <- 0',
			'  for v from 0 to length(counts) - 1',
			'    repeat counts[v] times: A[out] <- v + min; out <- out + 1',
			'  end for',
			'end procedure'
		],
		complexity: {
			best: 'O(n + k)',
			average: 'O(n + k)',
			worst: 'O(n + k)',
			space: 'O(k)',
			stable: true,
			inPlace: false,
			notes: 'k is the size of the value range (max - min + 1), not the number of distinct values. Counting sort is only linear when k is O(n); on a few values spread across a huge range it is far worse than a comparison sort. The simple write-back version shown here is stable for plain numbers; the prefix-sum version is what preserves stability for records with keys.'
		},
		js: `function countingSort(a) {
  if (a.length === 0) return [];
  const min = Math.min(...a);
  const max = Math.max(...a);
  const counts = new Array(max - min + 1).fill(0);
  for (const v of a) counts[v - min]++;
  const out = [];
  counts.forEach((c, i) => {
    for (let k = 0; k < c; k++) out.push(i + min);
  });
  return out;
}`,
		py: `def counting_sort(a):
    if not a:
        return []
    lo, hi = min(a), max(a)
    counts = [0] * (hi - lo + 1)
    for v in a:
        counts[v - lo] += 1
    out = []
    for i, c in enumerate(counts):
        out.extend([i + lo] * c)
    return out`,
		learn: {
			how: 'Counting sort never compares two values. It allocates one bucket per possible value in the range, tallies how many times each value appears, and then writes the values back in ascending bucket order. Because the ordering comes from the index of the bucket rather than from comparisons, it sidesteps the n log n lower bound that applies to comparison sorts - at the cost of needing to know and allocate the value range up front.',
			worked: 'Sorting [2, 5, 2, 3] with a range of 2 to 5: the counts are value 2 twice, value 3 once, value 4 zero times, value 5 once. Writing back in bucket order gives 2, 2, 3, then nothing for 4, then 5, producing [2, 2, 3, 5] after four count operations and four writes - no comparisons at all.',
			when: 'Use it for integer keys drawn from a small, known range: exam scores, ages, byte values, or as the stable inner pass of radix sort.',
			strengths: [
				'Linear time when the range is proportional to the number of items.',
				'Stable in the prefix-sum form, which is what makes radix sort work.',
				'No comparisons, so it beats the n log n comparison lower bound.'
			],
			weaknesses: [
				'Needs O(k) memory for the range, which explodes on sparse data.',
				'Only works on integer-like keys that can index an array.',
				'Not in place.'
			],
			mistakes: [
				'Describing it as O(n) without stating that k must be O(n).',
				'Forgetting to offset by the minimum, which breaks on negative values.',
				'Claiming the naive write-back version is stable for records with payloads - that needs the prefix-sum placement.'
			]
		}
	},

	// --------------------------------------------------------------- SEARCHING
	linear: {
		id: 'linear',
		family: 'searching',
		name: 'Linear search',
		tagline: 'Check each position in turn until the value appears.',
		pseudocode: [
			'procedure linearSearch(A, target)',
			'  for i from 0 to length(A) - 1',
			'    if A[i] = target then return i',
			'  end for',
			'  return not found',
			'end procedure'
		],
		complexity: {
			best: 'O(1)',
			average: 'O(n)',
			worst: 'O(n)',
			space: 'O(1)',
			stable: null,
			inPlace: null,
			notes: 'Best case is a hit at the first position. On a successful search of uniformly distributed targets the expected number of comparisons is (n+1)/2; an unsuccessful search always costs n.'
		},
		js: `function linearSearch(a, target) {
  for (let i = 0; i < a.length; i++) {
    if (a[i] === target) return i;
  }
  return -1;
}`,
		py: `def linear_search(a, target):
    for i, value in enumerate(a):
        if value == target:
            return i
    return -1`,
		learn: {
			how: 'Linear search simply looks at every position from the start until it either finds the target or runs out of data. It makes no assumption whatsoever about the order of the input, which is both its weakness (it cannot skip anything) and its strength (it works on data that no faster method can touch).',
			worked: 'Searching for 4 in [7, 3, 4, 9]: check index 0, which holds 7 and is not 4; check index 1, which holds 3 and is not 4; check index 2, which holds 4 - found, return index 2 after three comparisons. Searching for 5 in the same list costs all four comparisons and then reports not found.',
			when: 'Use it on unsorted data, on very short lists where the setup cost of anything smarter is not worth it, and when you need the first match in the original order.',
			strengths: [
				'Works on any order, including unsorted and linked data.',
				'No preprocessing or sorting required.',
				'Finds the first occurrence, which matters when duplicates are present.',
				'Trivially correct.'
			],
			weaknesses: [
				'Linear in the size of the data.',
				'Every unsuccessful search costs the full n comparisons.'
			],
			mistakes: [
				'Returning 0 instead of a dedicated not-found value, which is ambiguous with a hit at index 0.',
				'Continuing the loop after a match when only the first occurrence is wanted.',
				'Comparing with == in languages where that performs type coercion.'
			]
		}
	},

	binary: {
		id: 'binary',
		family: 'searching',
		name: 'Binary search',
		tagline: 'Halve a sorted range by comparing against its middle value.',
		pseudocode: [
			'procedure binarySearch(A, target)',
			'  lo <- 0; hi <- length(A) - 1',
			'  while lo <= hi',
			'    mid <- lo + floor((hi - lo) / 2)',
			'    if A[mid] = target then return mid',
			'    if A[mid] < target then lo <- mid + 1',
			'    else hi <- mid - 1',
			'  end while',
			'  return not found',
			'end procedure'
		],
		complexity: {
			best: 'O(1)',
			average: 'O(log n)',
			worst: 'O(log n)',
			space: 'O(1)',
			stable: null,
			inPlace: null,
			notes: 'Requires SORTED input; on unsorted data the result is simply wrong, not merely slow. The iterative form uses O(1) space, the recursive form O(log n) stack. The worst case is exactly floor(log2 n) + 1 comparisons.'
		},
		js: `function binarySearch(a, target) {
  let lo = 0;
  let hi = a.length - 1;
  while (lo <= hi) {
    // lo + (hi - lo) / 2 cannot overflow the way (lo + hi) / 2 can.
    const mid = lo + ((hi - lo) >> 1);
    if (a[mid] === target) return mid;
    if (a[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}`,
		py: `def binary_search(a, target):
    lo, hi = 0, len(a) - 1
    while lo <= hi:
        mid = lo + (hi - lo) // 2
        if a[mid] == target:
            return mid
        if a[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1`,
		learn: {
			how: 'Binary search keeps a candidate range and repeatedly throws away half of it. It compares the target against the middle value: if they match it is done; if the middle is too small the answer can only lie to the right, so the low bound moves past the middle; if the middle is too large the high bound moves below it. Each comparison halves the range, so a million sorted items need only about twenty comparisons. The whole method rests on the input being sorted - that is what makes "everything to the left is smaller" a valid deduction.',
			worked: 'Searching for 7 in [1, 3, 5, 7, 9, 11]: the range is 0 to 5 and the middle is index 2 holding 5, which is smaller than 7, so the range becomes 3 to 5. The new middle is index 4 holding 9, which is larger than 7, so the range becomes 3 to 3. The middle is now index 3 holding 7 - found in three comparisons instead of four.',
			when: 'Use it on any sorted array, and as the building block for lower-bound and upper-bound queries, insertion points and range counting.',
			strengths: [
				'Logarithmic in the worst case.',
				'Constant extra memory in the iterative form.',
				'Easy to extend into first-occurrence and insertion-point variants.'
			],
			weaknesses: [
				'Requires sorted data; sorting first costs n log n, so a single search on unsorted data is cheaper with a linear scan.',
				'Needs random access, so it is unsuitable for linked lists.',
				'With duplicates it returns an arbitrary matching index, not necessarily the first.'
			],
			mistakes: [
				'Running it on unsorted data - AlgoLens warns about this and offers to sort first, because the animation would otherwise show a confident wrong answer.',
				'Writing mid = (lo + hi) / 2, which overflows in fixed-width integer languages.',
				'Using while (lo < hi) with the wrong bound update and either skipping the last candidate or looping forever.',
				'Updating lo = mid rather than mid + 1, which never shrinks a two-element range.'
			]
		}
	},

	interpolation: {
		id: 'interpolation',
		family: 'searching',
		name: 'Interpolation search',
		tagline: 'Guess where the value should be, using how the data is spread.',
		pseudocode: [
			'procedure interpolationSearch(A, target)',
			'  lo <- 0; hi <- length(A) - 1',
			'  while lo <= hi',
			'    mid <- lo + (target - A[lo]) * (hi - lo) / (A[hi] - A[lo])',
			'    if A[mid] = target then return mid',
			'    if A[mid] < target then lo <- mid + 1',
			'    else hi <- mid - 1',
			'  end while',
			'  return not found',
			'end procedure'
		],
		complexity: {
			best: 'O(1)',
			average: 'O(log log n) on uniformly distributed sorted data',
			worst: 'O(n)',
			space: 'O(1)',
			stable: null,
			inPlace: null,
			notes: 'The O(log log n) average holds only for sorted data that is roughly uniformly distributed. On skewed data (for example exponentially growing values) the probe can advance by one position at a time, giving O(n) - worse than binary search.'
		},
		js: `function interpolationSearch(a, target) {
  let lo = 0;
  let hi = a.length - 1;
  while (lo <= hi && target >= a[lo] && target <= a[hi]) {
    const span = a[hi] - a[lo];
    const mid = span === 0 ? lo : lo + Math.floor(((target - a[lo]) * (hi - lo)) / span);
    if (a[mid] === target) return mid;
    if (a[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}`,
		py: `def interpolation_search(a, target):
    lo, hi = 0, len(a) - 1
    while lo <= hi and a[lo] <= target <= a[hi]:
        span = a[hi] - a[lo]
        mid = lo if span == 0 else lo + ((target - a[lo]) * (hi - lo)) // span
        if a[mid] == target:
            return mid
        if a[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1`,
		learn: {
			how: 'Interpolation search is binary search that guesses more cleverly. Instead of always probing the midpoint, it assumes the values increase roughly evenly across the range and computes where the target would sit if that were exactly true. Looking for 95 in a range that runs from 1 to 100 therefore probes near the far right rather than the middle. When the assumption holds the range shrinks dramatically each step; when it does not, the probe can crawl and the method is slower than plain binary search.',
			worked: 'Searching for 70 in [10, 20, 30, 40, 50, 60, 70, 80]: the span is 80 minus 10 equals 70, and the target sits (70-10)/70 of the way along 7 positions, which is index 6. Index 6 holds exactly 70, so it is found with a single comparison where binary search would have taken three.',
			when: 'Use it on large, sorted, uniformly distributed numeric data - sorted timestamps, sequential ids, evenly spaced measurements.',
			strengths: [
				'Can find a value in one or two probes on evenly spread data.',
				'Constant extra memory.',
				'Degrades to a correct answer even when the distribution assumption fails.'
			],
			weaknesses: [
				'O(n) worst case on skewed data.',
				'Needs arithmetic on the keys, so it does not apply to arbitrary comparable types.',
				'The formula must guard against a zero span and against probes outside the range.'
			],
			mistakes: [
				'Dividing by A[hi] - A[lo] without checking for zero, which happens whenever the range is all one value.',
				'Letting the computed probe fall outside lo..hi and indexing out of bounds.',
				'Assuming it always beats binary search; on clustered data it does not.'
			]
		}
	},

	// ------------------------------------------------------------- PATHFINDING
	'path-bfs': {
		id: 'path-bfs',
		family: 'pathfinding',
		name: 'Breadth-first search',
		tagline: 'Explore in rings of equal distance using a queue.',
		pseudocode: [
			'procedure bfs(grid, start, goal)',
			'  queue <- [start]; seen <- {start}',
			'  while queue is not empty',
			'    current <- remove from the FRONT of queue',
			'    if current = goal then reconstruct the path',
			'    for each open neighbour n of current',
			'      if n not in seen then add n to seen and to the BACK of queue',
			'    mark current as visited',
			'  end while',
			'  report no path',
			'end procedure'
		],
		complexity: {
			best: 'O(1)',
			average: 'O(V + E)',
			worst: 'O(V + E)',
			space: 'O(V)',
			stable: null,
			inPlace: null,
			notes: 'On a grid V is the number of cells and E is at most 4V (or 8V with diagonals). BFS finds the fewest MOVES, which equals the cheapest path only when every cell costs the same. With weights it is not a shortest-cost algorithm, and AlgoLens verifies it against a move-count reference rather than a cost reference.'
		},
		js: `function bfs(grid, start, goal, neighbours) {
  const prev = new Map([[start, null]]);
  const queue = [start];
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    if (current === goal) break;
    for (const n of neighbours(current)) {
      if (prev.has(n)) continue;
      prev.set(n, current);
      queue.push(n);
    }
  }
  if (!prev.has(goal)) return null;
  const path = [];
  for (let at = goal; at !== null; at = prev.get(at)) path.unshift(at);
  return path;
}`,
		py: `from collections import deque

def bfs(start, goal, neighbours):
    prev = {start: None}
    queue = deque([start])
    while queue:
        current = queue.popleft()
        if current == goal:
            break
        for n in neighbours(current):
            if n in prev:
                continue
            prev[n] = current
            queue.append(n)
    if goal not in prev:
        return None
    path, at = [], goal
    while at is not None:
        path.append(at)
        at = prev[at]
    return path[::-1]`,
		learn: {
			how: 'Breadth-first search expands outwards in rings. The queue holds cells in the order they were discovered, and because a cell is always discovered from a cell that is one move closer to the start, taking cells from the front of the queue means every cell at distance one is expanded before any cell at distance two. That ordering is what guarantees the first time the goal is reached, it is reached by a path with the fewest moves. Note that fewest moves is not the same as cheapest when cells have different costs.',
			worked: 'On an open 3-by-1 strip with the start at the left: the queue begins as [start]. Expanding the start discovers its right neighbour, so the queue becomes [middle]. Expanding the middle discovers the right end, so the queue becomes [right]. Expanding the right end reaches the goal after two moves - exactly the minimum.',
			when: 'Use it on unweighted grids and graphs when you want the shortest number of steps, for flood fill, for finding connected components and for computing distance layers.',
			strengths: [
				'Guaranteed fewest moves on unweighted data.',
				'Simple, with only a queue and a seen set.',
				'Visits each cell and edge once, so it is linear.'
			],
			weaknesses: [
				'Ignores weights entirely, so it is not a cheapest-path algorithm on weighted grids.',
				'Explores in every direction equally, so it visits far more cells than A* on a large open map.',
				'Memory grows with the size of the frontier, which on a wide-open grid is large.'
			],
			mistakes: [
				'Marking a cell as seen when it is removed from the queue rather than when it is added, which lets the same cell enter the queue many times.',
				'Using pop() instead of shift() and silently turning BFS into DFS.',
				'Claiming shortest cost rather than shortest move count on a weighted grid.'
			]
		}
	},

	'path-dfs': {
		id: 'path-dfs',
		family: 'pathfinding',
		name: 'Depth-first search',
		tagline: 'Follow one direction as far as possible using a stack.',
		pseudocode: [
			'procedure dfs(grid, start, goal)',
			'  stack <- [start]; seen <- {start}',
			'  while stack is not empty',
			'    current <- remove from the TOP of stack',
			'    if current = goal then reconstruct the path',
			'    for each open neighbour n of current',
			'      if n not in seen then add n to seen and push n',
			'    mark current as visited',
			'  end while',
			'  report no path',
			'end procedure'
		],
		complexity: {
			best: 'O(1)',
			average: 'O(V + E)',
			worst: 'O(V + E)',
			space: 'O(V)',
			stable: null,
			inPlace: null,
			notes: 'DFS gives NO shortest-path guarantee of any kind. It returns the first path it happens to find, which is routinely much longer than the optimum - AlgoLens tests assert that this really happens on random grids, and the verifier checks only that the path is legal, not that it is short.'
		},
		js: `function dfs(start, goal, neighbours) {
  const prev = new Map([[start, null]]);
  const stack = [start];
  while (stack.length) {
    const current = stack.pop();
    if (current === goal) break;
    for (const n of neighbours(current)) {
      if (prev.has(n)) continue;
      prev.set(n, current);
      stack.push(n);
    }
  }
  if (!prev.has(goal)) return null;
  const path = [];
  for (let at = goal; at !== null; at = prev.get(at)) path.unshift(at);
  return path;
}`,
		py: `def dfs(start, goal, neighbours):
    prev = {start: None}
    stack = [start]
    while stack:
        current = stack.pop()
        if current == goal:
            break
        for n in neighbours(current):
            if n in prev:
                continue
            prev[n] = current
            stack.append(n)
    if goal not in prev:
        return None
    path, at = [], goal
    while at is not None:
        path.append(at)
        at = prev[at]
    return path[::-1]`,
		learn: {
			how: 'Depth-first search commits to one direction and keeps going until it hits a dead end, then backtracks to the most recent place where another option was available. Swapping the BFS queue for a stack is the only structural change, but it completely changes the behaviour: the most recently discovered cell is explored next, so the search plunges deep rather than spreading wide. Nothing about that order relates to distance from the start, which is precisely why the path it finds is not the shortest.',
			worked: 'On an open 3-by-3 grid going from the top-left to the bottom-right, DFS may walk right along the whole top row, then down the right column, reaching the goal in four moves - or, depending on the neighbour order, it may walk down the left column first, along the bottom, and arrive by a longer route having visited almost every cell. Both are legal DFS results; neither is guaranteed minimal.',
			when: 'Use it to test reachability, to detect cycles, to generate mazes (the randomised DFS generator in AlgoLens is exactly this), and for topological ordering. Use it for shortest paths only if you do not actually need the shortest path.',
			strengths: [
				'Very low memory on deep, narrow search spaces.',
				'Simple to write recursively.',
				'Excellent for connectivity, cycle detection and maze generation.'
			],
			weaknesses: [
				'No shortest-path guarantee at all.',
				'Can wander far from the goal before finding it.',
				'The recursive form can overflow the stack on large inputs.'
			],
			mistakes: [
				'Presenting a DFS route as the shortest path.',
				'Forgetting the seen set and revisiting cells forever on a cyclic graph.',
				'Assuming the recursive and iterative versions explore in the same order - the stack reverses the neighbour order.'
			]
		}
	},

	'path-dijkstra': {
		id: 'path-dijkstra',
		family: 'pathfinding',
		name: "Dijkstra's algorithm",
		tagline: 'Always expand the cheapest cell reached so far.',
		pseudocode: [
			'procedure dijkstra(grid, start, goal)',
			'  dist[start] <- 0; all other dist <- infinity',
			'  open <- priority queue holding start with key 0',
			'  while open is not empty',
			'    current <- remove the SMALLEST key from open',
			'    if current = goal then reconstruct the path',
			'    for each open neighbour n of current',
			'      if dist[current] + cost(n) < dist[n] then relax: update dist[n] and prev[n]',
			'    close current',
			'  end while',
			'  report no path',
			'end procedure'
		],
		complexity: {
			best: 'O(E + V log V)',
			average: 'O(E log V) with a binary heap',
			worst: 'O(E log V) with a binary heap',
			space: 'O(V)',
			stable: null,
			inPlace: null,
			notes: 'O(E log V) is the standard binary-heap bound; a Fibonacci heap improves it to O(E + V log V), which is why both appear in textbooks. Requires NON-NEGATIVE weights - with a negative edge the closed-set argument fails and the answer can be wrong, so AlgoLens rejects negative weights outright.'
		},
		js: `function dijkstra(start, goal, neighbours, cost) {
  const dist = new Map([[start, 0]]);
  const prev = new Map([[start, null]]);
  const closed = new Set();
  // A real implementation uses a binary heap; a sorted array keeps the idea clear.
  const open = [{ key: 0, node: start }];
  while (open.length) {
    open.sort((a, b) => a.key - b.key);
    const { node: current } = open.shift();
    if (closed.has(current)) continue;
    closed.add(current);
    if (current === goal) break;
    for (const n of neighbours(current)) {
      if (closed.has(n)) continue;
      const candidate = dist.get(current) + cost(current, n);
      if (candidate < (dist.get(n) ?? Infinity)) {
        dist.set(n, candidate);
        prev.set(n, current);
        open.push({ key: candidate, node: n });
      }
    }
  }
  return { dist, prev };
}`,
		py: `import heapq

def dijkstra(start, goal, neighbours, cost):
    dist = {start: 0}
    prev = {start: None}
    closed = set()
    open_set = [(0, start)]
    while open_set:
        _, current = heapq.heappop(open_set)
        if current in closed:
            continue
        closed.add(current)
        if current == goal:
            break
        for n in neighbours(current):
            if n in closed:
                continue
            candidate = dist[current] + cost(current, n)
            if candidate < dist.get(n, float("inf")):
                dist[n] = candidate
                prev[n] = current
                heapq.heappush(open_set, (candidate, n))
    return dist, prev`,
		learn: {
			how: "Dijkstra's algorithm generalises BFS to weighted graphs by replacing the queue with a priority queue keyed on the cost so far. It always expands whichever reachable cell is currently cheapest. The key insight is that when a cell is pulled off the queue, no cheaper route to it can still be waiting - because every route still in the queue already costs at least as much, and adding more non-negative edges can only increase the total. That argument is exactly where negative weights break it: a negative edge could make a later route cheaper, so a cell closed early might be wrong.",
			worked: 'On a strip where the start connects to A at cost 1 and B at cost 4, and A connects to B at cost 1: Dijkstra expands the start, relaxing A to 1 and B to 4. It then expands the cheapest open cell, A at 1, and relaxes B from 4 down to 2 because 1 plus 1 beats 4. Finally it expands B at cost 2 - the true cheapest route, which BFS would have missed because B is only one move away from the start.',
			when: 'Use it whenever edge costs differ and you need a genuine cheapest path: road networks with travel times, terrain with movement penalties, or network routing.',
			strengths: [
				'Guarantees the cheapest path with non-negative weights.',
				'Produces cheapest distances to every cell it closes, not just to the goal.',
				'Needs no heuristic and therefore no domain knowledge.'
			],
			weaknesses: [
				'Expands in all directions, so it explores many more cells than A* on a large map.',
				'Cannot handle negative weights (use Bellman-Ford for those).',
				'Needs a priority queue, which costs a log factor.'
			],
			mistakes: [
				'Running it with negative weights and trusting the answer.',
				'Failing to skip a node that has already been closed when using the lazy-deletion heap pattern, which double-counts work.',
				'Relaxing with >= instead of <, which records needless updates.',
				'Stopping at the first time the goal is *discovered* rather than the first time it is *closed*.'
			]
		}
	},

	'path-astar': {
		id: 'path-astar',
		family: 'pathfinding',
		name: 'A* search',
		tagline: 'Dijkstra plus an estimate of the distance still to go.',
		pseudocode: [
			'procedure aStar(grid, start, goal, h)',
			'  g[start] <- 0; f[start] <- h(start, goal)',
			'  open <- priority queue holding start with key f[start]',
			'  while open is not empty',
			'    current <- remove the SMALLEST f from open',
			'    if current = goal then reconstruct the path',
			'    for each open neighbour n of current',
			'      if g[current] + cost(n) < g[n] then relax and set f[n] <- g[n] + h(n, goal)',
			'    close current',
			'  end while',
			'  report no path',
			'end procedure'
		],
		complexity: {
			best: 'O(1)',
			average: 'O(E log V) with a binary heap',
			worst: 'O(E log V) with a binary heap',
			space: 'O(V)',
			stable: null,
			inPlace: null,
			notes: 'A* has the same asymptotic bound as Dijkstra; the heuristic reduces the constant, often dramatically, not the order. It returns a cheapest path only when the heuristic is ADMISSIBLE (never overestimates). With 8-way movement and equal diagonal cost, Manhattan distance overestimates and is therefore not admissible - AlgoLens reports this in the UI instead of quietly returning a suboptimal path.'
		},
		js: `function aStar(start, goal, neighbours, cost, h) {
  const g = new Map([[start, 0]]);
  const prev = new Map([[start, null]]);
  const closed = new Set();
  const open = [{ key: h(start, goal), node: start }];
  while (open.length) {
    open.sort((a, b) => a.key - b.key);
    const { node: current } = open.shift();
    if (closed.has(current)) continue;
    closed.add(current);
    if (current === goal) break;
    for (const n of neighbours(current)) {
      if (closed.has(n)) continue;
      const candidate = g.get(current) + cost(current, n);
      if (candidate < (g.get(n) ?? Infinity)) {
        g.set(n, candidate);
        prev.set(n, current);
        open.push({ key: candidate + h(n, goal), node: n });
      }
    }
  }
  return { g, prev };
}`,
		py: `import heapq

def a_star(start, goal, neighbours, cost, h):
    g = {start: 0}
    prev = {start: None}
    closed = set()
    open_set = [(h(start, goal), start)]
    while open_set:
        _, current = heapq.heappop(open_set)
        if current in closed:
            continue
        closed.add(current)
        if current == goal:
            break
        for n in neighbours(current):
            if n in closed:
                continue
            candidate = g[current] + cost(current, n)
            if candidate < g.get(n, float("inf")):
                g[n] = candidate
                prev[n] = current
                heapq.heappush(open_set, (candidate + h(n, goal), n))
    return g, prev`,
		learn: {
			how: 'A* orders its priority queue by f = g + h, where g is the known cost from the start and h is an estimate of the cost still to go. Because cells that point towards the goal get a smaller f, the search is pulled in the right direction and typically touches far fewer cells than Dijkstra. Correctness depends entirely on h never overestimating the true remaining cost - a property called admissibility. With h equal to zero, A* is exactly Dijkstra; with an admissible h it still returns a cheapest path; with an inadmissible h it becomes fast but can return a route that is not cheapest.',
			worked: 'On an open grid with the goal straight to the east, Dijkstra expands a growing disc around the start. A* with Manhattan distance gives every cell to the east a smaller f, so the frontier becomes a narrow cone pointed at the goal. Both return a path of the same cost, but A* may close a handful of cells where Dijkstra closes hundreds. Switch the grid to 8-way movement and keep Manhattan, and the estimate now exceeds the real diagonal cost: the search is faster still, but the path it returns may no longer be cheapest, which is why AlgoLens labels that combination as not guaranteed.',
			when: 'Use it for grid and map pathfinding in games, robotics and route planning, wherever a good distance estimate exists.',
			strengths: [
				'Usually explores a small fraction of what Dijkstra explores.',
				'Still optimal with an admissible heuristic.',
				'The heuristic is a clean place to inject domain knowledge.'
			],
			weaknesses: [
				'Optimality depends on the heuristic, which is easy to get wrong.',
				'Still stores a full open and closed set, so memory is like Dijkstra.',
				'A heuristic that is admissible but not consistent needs node re-opening to stay optimal.'
			],
			mistakes: [
				'Pairing Manhattan distance with diagonal movement, which overestimates and breaks optimality.',
				'Forgetting to recompute f after relaxing g.',
				'Comparing f values when deciding whether to relax; the comparison must be on g.',
				'Scaling the heuristic up "to go faster" and then still calling the result shortest.'
			]
		}
	},

	'path-greedy': {
		id: 'path-greedy',
		family: 'pathfinding',
		name: 'Greedy best-first search',
		tagline: 'Always move to whatever looks closest to the goal.',
		pseudocode: [
			'procedure greedyBestFirst(grid, start, goal, h)',
			'  open <- priority queue holding start with key h(start, goal)',
			'  while open is not empty',
			'    current <- remove the SMALLEST h from open',
			'    if current = goal then reconstruct the path',
			'    for each open neighbour n of current',
			'      if n is unvisited then add n with key h(n, goal)',
			'    close current',
			'  end while',
			'  report no path',
			'end procedure'
		],
		complexity: {
			best: 'O(1)',
			average: 'O(E log V) with a binary heap',
			worst: 'O(E log V) with a binary heap',
			space: 'O(V)',
			stable: null,
			inPlace: null,
			notes: 'NO shortest-path guarantee, with any heuristic, because the cost already paid is ignored completely. It is usually the fastest of these searches to reach the goal and often returns a visibly worse route - AlgoLens verifies the route is legal and reports its cost against the Dijkstra optimum rather than claiming it is shortest.'
		},
		js: `function greedyBestFirst(start, goal, neighbours, h) {
  const prev = new Map([[start, null]]);
  const closed = new Set();
  const open = [{ key: h(start, goal), node: start }];
  while (open.length) {
    open.sort((a, b) => a.key - b.key);
    const { node: current } = open.shift();
    if (closed.has(current)) continue;
    closed.add(current);
    if (current === goal) break;
    for (const n of neighbours(current)) {
      if (closed.has(n) || prev.has(n)) continue;
      prev.set(n, current);
      open.push({ key: h(n, goal), node: n }); // note: g is ignored
    }
  }
  return prev;
}`,
		py: `import heapq

def greedy_best_first(start, goal, neighbours, h):
    prev = {start: None}
    closed = set()
    open_set = [(h(start, goal), start)]
    while open_set:
        _, current = heapq.heappop(open_set)
        if current in closed:
            continue
        closed.add(current)
        if current == goal:
            break
        for n in neighbours(current):
            if n in closed or n in prev:
                continue
            prev[n] = current
            heapq.heappush(open_set, (h(n, goal), n))  # note: g is ignored
    return prev`,
		learn: {
			how: 'Greedy best-first search keeps only the heuristic in its priority queue: it always expands whichever open cell appears closest to the goal, with no regard for how much it has already spent getting there. That makes it beeline towards the target and reach it very quickly on an open map. But because the cost so far is thrown away, it will happily take an expensive shortcut, and when a wall blocks the direct line it tends to hug the obstacle rather than back off and go around efficiently.',
			worked: 'Place a long vertical wall between the start and the goal with a single gap near the bottom. Greedy walks straight at the wall because every step reduces the straight-line distance, then slides along it to the gap and squeezes through - producing a path that doubles back on itself. Dijkstra and A* both head for the gap from the beginning and return a shorter route.',
			when: 'Use it when "good enough, immediately" beats "optimal, eventually": quick previews, very large maps, or as the first stage of a two-pass planner.',
			strengths: [
				'Typically reaches the goal after examining very few cells.',
				'Simple - no g values to maintain.',
				'Behaves well on open maps with few obstacles.'
			],
			weaknesses: [
				'No optimality guarantee whatsoever.',
				'Easily trapped by concave obstacles.',
				'Ignores weights, so it will cross expensive terrain to save distance.'
			],
			mistakes: [
				'Describing it as A*; the difference is precisely the missing g term.',
				'Expecting the shortest path because the heuristic is admissible - admissibility does not help here.',
				'Forgetting the closed set, which on a grid causes repeated expansion.'
			]
		}
	},

	// ------------------------------------------------------------------ GRAPHS
	'graph-bfs': {
		id: 'graph-bfs',
		family: 'graph',
		name: 'BFS traversal',
		tagline: 'Visit nodes in rings of equal hop distance.',
		pseudocode: [
			'procedure bfsTraversal(G, start)',
			'  queue <- [start]; seen <- {start}',
			'  while queue is not empty',
			'    current <- remove from the FRONT of queue',
			'    record current in the visit order',
			'    for each neighbour n of current',
			'      if n not in seen then add n to seen and to the BACK of queue',
			'    mark current as explored',
			'  end while',
			'end procedure'
		],
		complexity: {
			best: 'O(V + E)',
			average: 'O(V + E)',
			worst: 'O(V + E)',
			space: 'O(V)',
			stable: null,
			inPlace: null,
			notes: 'Each node enters the queue at most once and each edge is examined once per direction, giving O(V + E) with adjacency lists. With an adjacency matrix it is O(V^2).'
		},
		js: `function bfsTraversal(adjacency, start) {
  const seen = new Set([start]);
  const order = [];
  const queue = [start];
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    order.push(current);
    for (const n of adjacency.get(current) ?? []) {
      if (seen.has(n)) continue;
      seen.add(n);
      queue.push(n);
    }
  }
  return order;
}`,
		py: `from collections import deque

def bfs_traversal(adjacency, start):
    seen = {start}
    order = []
    queue = deque([start])
    while queue:
        current = queue.popleft()
        order.append(current)
        for n in adjacency.get(current, []):
            if n in seen:
                continue
            seen.add(n)
            queue.append(n)
    return order`,
		learn: {
			how: 'BFS traversal on a node-link graph works exactly as it does on a grid: the queue enforces a first-in, first-out order, so all neighbours of the start are visited before any of their neighbours. Watching the queue contents in AlgoLens makes the structure obvious - nodes enter at the back and leave from the front, and the visit order is always sorted by hop distance from the start.',
			worked: 'On the sample graph starting at A, A is visited first and discovers B and D. B leaves the queue next and discovers C and E. D leaves next and discovers nothing new except through E. The order is therefore A, B, D, then C and E, then F - distance 0, then distance 1, then distance 2.',
			when: 'Use it to find connected components, to compute hop distances, to test bipartiteness and as the basis of unweighted shortest paths.',
			strengths: [
				'Linear in the size of the graph.',
				'Gives shortest hop distances for free.',
				'Order is deterministic once the adjacency order is fixed.'
			],
			weaknesses: [
				'The frontier can be as large as the graph, so memory is O(V).',
				'Ignores weights.'
			],
			mistakes: [
				'Adding to the seen set on dequeue instead of enqueue, which allows duplicates.',
				'Using an array shift() on a huge graph, which is O(n) per operation - use a head index or a real deque.',
				'Forgetting to restart the traversal from unvisited nodes when the graph is disconnected.'
			]
		}
	},

	'graph-dfs': {
		id: 'graph-dfs',
		family: 'graph',
		name: 'DFS traversal',
		tagline: 'Follow each branch to its end before backtracking.',
		pseudocode: [
			'procedure dfsTraversal(G, start)',
			'  stack <- [start]; seen <- {start}',
			'  while stack is not empty',
			'    current <- remove from the TOP of stack',
			'    record current in the visit order',
			'    for each neighbour n of current',
			'      if n not in seen then add n to seen and push n',
			'    mark current as explored',
			'  end while',
			'end procedure'
		],
		complexity: {
			best: 'O(V + E)',
			average: 'O(V + E)',
			worst: 'O(V + E)',
			space: 'O(V)',
			stable: null,
			inPlace: null,
			notes: 'Same bound as BFS. Space is O(V) in the worst case for both; on a deep narrow graph DFS uses much less in practice, and on a wide shallow one BFS does.'
		},
		js: `function dfsTraversal(adjacency, start) {
  const seen = new Set([start]);
  const order = [];
  const stack = [start];
  while (stack.length) {
    const current = stack.pop();
    order.push(current);
    for (const n of adjacency.get(current) ?? []) {
      if (seen.has(n)) continue;
      seen.add(n);
      stack.push(n);
    }
  }
  return order;
}`,
		py: `def dfs_traversal(adjacency, start):
    seen = {start}
    order = []
    stack = [start]
    while stack:
        current = stack.pop()
        order.append(current)
        for n in adjacency.get(current, []):
            if n in seen:
                continue
            seen.add(n)
            stack.append(n)
    return order`,
		learn: {
			how: 'DFS traversal replaces the BFS queue with a stack, so the most recently discovered node is explored next. The visit order therefore dives along a single branch until it is exhausted, then unwinds to the last node that still had an unexplored neighbour. Because the stack reverses the order in which neighbours were pushed, the iterative version usually visits siblings in the opposite order to the recursive version - both are valid depth-first orders.',
			worked: 'On the sample graph starting at A with neighbours ordered B then D: both are pushed, and because the stack pops the last one, D is visited before B. From D the search dives to E, from E to its unexplored neighbours, and only unwinds back to B when that branch is finished - a very different order from the BFS ring pattern on the same graph.',
			when: 'Use it for cycle detection, topological ordering, strongly connected components, bridge and articulation-point finding, and anywhere the recursive structure of the graph matters.',
			strengths: [
				'Linear time.',
				'Low memory on deep graphs.',
				'The discovery and finish times it produces underpin many classic algorithms.'
			],
			weaknesses: [
				'Gives no distance information.',
				'The recursive form can overflow the call stack.',
				'Visit order is sensitive to the adjacency order, which surprises people.'
			],
			mistakes: [
				'Expecting the iterative and recursive versions to produce identical orders.',
				'Omitting the seen check and looping forever on a cycle.',
				'Marking nodes visited only on pop, which lets a node be pushed many times.'
			]
		}
	},

	'graph-dijkstra': {
		id: 'graph-dijkstra',
		family: 'graph',
		name: "Dijkstra's shortest path",
		tagline: 'Finalise nodes in increasing order of distance from the source.',
		pseudocode: [
			'procedure dijkstra(G, source)',
			'  dist[source] <- 0; all other dist <- infinity',
			'  open <- priority queue holding source with key 0',
			'  while open is not empty',
			'    u <- remove the SMALLEST key from open',
			'    for each edge (u, v) with weight w',
			'      if dist[u] + w < dist[v] then dist[v] <- dist[u] + w; prev[v] <- u; push v',
			'    finalise u',
			'  end while',
			'end procedure'
		],
		complexity: {
			best: 'O(E + V log V)',
			average: 'O(E log V) with a binary heap',
			worst: 'O(E log V) with a binary heap',
			space: 'O(V)',
			stable: null,
			inPlace: null,
			notes: 'The O(E + V log V) figure is the Fibonacci-heap bound; O(E log V) is the usual binary-heap one. Negative weights are rejected: the proof relies on never needing to revisit a finalised node, which a negative edge invalidates.'
		},
		js: `function dijkstraGraph(adjacency, source) {
  const dist = new Map([[source, 0]]);
  const prev = new Map();
  const done = new Set();
  const open = [{ key: 0, node: source }];
  while (open.length) {
    open.sort((a, b) => a.key - b.key);
    const { node: u } = open.shift();
    if (done.has(u)) continue;
    done.add(u);
    for (const { to, weight } of adjacency.get(u) ?? []) {
      if (weight < 0) throw new Error('Dijkstra requires non-negative weights.');
      const candidate = dist.get(u) + weight;
      if (candidate < (dist.get(to) ?? Infinity)) {
        dist.set(to, candidate);
        prev.set(to, u);
        open.push({ key: candidate, node: to });
      }
    }
  }
  return { dist, prev };
}`,
		py: `import heapq

def dijkstra_graph(adjacency, source):
    dist = {source: 0}
    prev = {}
    done = set()
    open_set = [(0, source)]
    while open_set:
        _, u = heapq.heappop(open_set)
        if u in done:
            continue
        done.add(u)
        for to, weight in adjacency.get(u, []):
            if weight < 0:
                raise ValueError("Dijkstra requires non-negative weights.")
            candidate = dist[u] + weight
            if candidate < dist.get(to, float("inf")):
                dist[to] = candidate
                prev[to] = u
                heapq.heappush(open_set, (candidate, to))
    return dist, prev`,
		learn: {
			how: "On a node-link graph Dijkstra's algorithm maintains a tentative distance for every node and finalises them one at a time, always choosing the smallest tentative distance remaining. Each time a node is finalised the algorithm relaxes its outgoing edges: if going through this node gives a cheaper route to a neighbour, the neighbour's distance and predecessor are updated. The distance table in AlgoLens shows exactly this - values start at infinity, drop as edges are relaxed, and freeze once their node is finalised.",
			worked: 'On the sample graph from A: A is finalised at 0, relaxing B to 4 and D to 3. D is the smallest open value so it is finalised at 3, relaxing E to 10. B is finalised at 4, relaxing C to 9 and improving E from 10 down to 6. E is finalised at 6 and relaxes F to 10. C is finalised at 9 and improves F to 15 - no, 9 plus 6 is 15 which does not beat 10, so no update. F is finalised at 10 by way of A, B, E.',
			when: 'Use it for weighted shortest paths with non-negative weights: routing, scheduling, cost minimisation over a network.',
			strengths: [
				'Correct cheapest paths from one source to every reachable node.',
				'Works on directed and undirected graphs alike.',
				'Predecessor pointers reconstruct the actual path, not just the cost.'
			],
			weaknesses: [
				'Negative weights are not allowed.',
				'Single-source only; all-pairs needs V runs or Floyd-Warshall.',
				'Explores everything closer than the target.'
			],
			mistakes: [
				'Running it on negative weights, which AlgoLens refuses outright with an explanation.',
				'Updating a node already finalised.',
				'Confusing the tentative and final distances when reading the distance table.',
				'Assuming the first path discovered to a node is the final one.'
			]
		}
	},

	'graph-prim': {
		id: 'graph-prim',
		family: 'graph',
		name: "Prim's minimum spanning tree",
		tagline: 'Grow one tree by always adding its cheapest outgoing edge.',
		pseudocode: [
			'procedure prim(G, start)',
			'  tree <- {start}; offer all edges leaving start',
			'  while the tree does not span the component',
			'    e <- the cheapest offered edge',
			'    if e leads to a node already in the tree then reject it (it would make a cycle)',
			'    else add e and its new node to the tree',
			'    offer all edges leaving the new node',
			'  end while',
			'end procedure'
		],
		complexity: {
			best: 'O(E log V)',
			average: 'O(E log V) with a binary heap',
			worst: 'O(E log V) with a binary heap',
			space: 'O(V + E)',
			stable: null,
			inPlace: null,
			notes: 'O(E log V) with a binary heap; O(E + V log V) with a Fibonacci heap and O(V^2) with a simple array scan, which is actually better on dense graphs. On a disconnected graph it spans only the component containing the start node, which AlgoLens states explicitly rather than reporting a wrong total.'
		},
		js: `function prim(adjacency, start) {
  const inTree = new Set([start]);
  const picked = [];
  let total = 0;
  const offers = [];
  const offer = (node) => {
    for (const { to, weight } of adjacency.get(node) ?? []) {
      if (!inTree.has(to)) offers.push({ weight, from: node, to });
    }
  };
  offer(start);
  while (offers.length) {
    offers.sort((a, b) => a.weight - b.weight);
    const edge = offers.shift();
    if (inTree.has(edge.to)) continue; // would close a cycle
    inTree.add(edge.to);
    picked.push(edge);
    total += edge.weight;
    offer(edge.to);
  }
  return { edges: picked, total };
}`,
		py: `import heapq

def prim(adjacency, start):
    in_tree = {start}
    picked, total = [], 0
    offers = []

    def offer(node):
        for to, weight in adjacency.get(node, []):
            if to not in in_tree:
                heapq.heappush(offers, (weight, node, to))

    offer(start)
    while offers:
        weight, frm, to = heapq.heappop(offers)
        if to in in_tree:
            continue  # would close a cycle
        in_tree.add(to)
        picked.append((frm, to, weight))
        total += weight
        offer(to)
    return picked, total`,
		learn: {
			how: "Prim's algorithm keeps a single connected tree and repeatedly absorbs the cheapest edge that leaves it. Because the tree is always connected, any edge whose far end is already inside would create a cycle and is discarded. The reason the greedy choice is safe is the cut property: for any way of splitting the nodes into two groups, the cheapest edge crossing that split belongs to some minimum spanning tree - and the tree-versus-rest split is exactly the one Prim looks at each round.",
			worked: 'On the sample graph from A: the offered edges are A-B at 4 and A-D at 3. The cheapest is A-D, so D joins at cost 3. Now D-E at 7 and D-F at 11 are offered too; the cheapest overall is A-B at 4, so B joins. B-E at 2 is now offered and is the cheapest, so E joins at 2. E-F at 4 is offered and beats the rest, so F joins. Finally B-C at 5 brings in C. The total is 3 plus 4 plus 2 plus 4 plus 5, which is 18.',
			when: "Use it on dense graphs, where Prim's array variant at O(V^2) beats Kruskal's sorting step, and whenever you want the tree to grow outwards from a particular node.",
			strengths: [
				'Naturally incremental: the partial result is always a connected tree.',
				'Efficient on dense graphs.',
				'Needs no union-find structure.'
			],
			weaknesses: [
				'Only spans the component containing the start node.',
				'Needs a priority queue over edges or a repeated minimum scan.',
				'Less convenient than Kruskal when the edges arrive pre-sorted.'
			],
			mistakes: [
				'Reporting a total for a disconnected graph as if it spanned everything.',
				'Re-offering edges into the tree and counting them twice.',
				'Confusing it with Dijkstra: Prim keys on the edge weight alone, Dijkstra on the accumulated distance.'
			]
		}
	},

	'graph-kruskal': {
		id: 'graph-kruskal',
		family: 'graph',
		name: "Kruskal's minimum spanning tree",
		tagline: 'Take edges cheapest-first, skipping any that close a cycle.',
		pseudocode: [
			'procedure kruskal(G)',
			'  sort all edges by weight',
			'  put every node in its own set',
			'  for each edge (u, v) in sorted order',
			'    if find(u) = find(v) then reject the edge (it would make a cycle)',
			'    else accept the edge and union the two sets',
			'  end for',
			'end procedure'
		],
		complexity: {
			best: 'O(E log E)',
			average: 'O(E log E)',
			worst: 'O(E log E)',
			space: 'O(V + E)',
			stable: null,
			inPlace: null,
			notes: 'Sorting dominates at O(E log E), which is the same as O(E log V) because E is at most V^2. The union-find operations add only an inverse-Ackermann factor with path compression and union by rank, which is effectively constant. On a disconnected graph the result is a minimum spanning FOREST, and AlgoLens labels it as such.'
		},
		js: `function kruskal(nodes, edges) {
  const parent = new Map(nodes.map((n) => [n, n]));
  const find = (x) => {
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x))); // path compression
      x = parent.get(x);
    }
    return x;
  };
  const picked = [];
  let total = 0;
  for (const edge of [...edges].sort((a, b) => a.weight - b.weight)) {
    const ra = find(edge.from);
    const rb = find(edge.to);
    if (ra === rb) continue; // would close a cycle
    parent.set(ra, rb);
    picked.push(edge);
    total += edge.weight;
  }
  return { edges: picked, total };
}`,
		py: `def kruskal(nodes, edges):
    parent = {n: n for n in nodes}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]  # path compression
            x = parent[x]
        return x

    picked, total = [], 0
    for frm, to, weight in sorted(edges, key=lambda e: e[2]):
        ra, rb = find(frm), find(to)
        if ra == rb:
            continue  # would close a cycle
        parent[ra] = rb
        picked.append((frm, to, weight))
        total += weight
    return picked, total`,
		learn: {
			how: "Kruskal's algorithm forgets about connectivity while it works. It sorts every edge by weight and walks the list from cheapest to dearest, accepting an edge whenever its two endpoints are currently in different components and rejecting it when they are already connected. A union-find (disjoint-set) structure answers the \"same component?\" question in near-constant time and merges the two sets when an edge is accepted. The AlgoLens set panel shows these groups merging, which makes the cycle rejections easy to understand.",
			worked: 'On the sample graph the sorted edges begin B-E at 2, A-D at 3, A-B at 4, E-F at 4, then B-C at 5. Accept B-E (sets {B,E}), accept A-D (sets {A,D}), accept A-B (which merges {A,D} and {B,E} into one set of four), accept E-F (adding F), accept B-C (adding C). All six nodes are now in one set, so the remaining edges - C-F at 6, D-E at 7, D-F at 11 - are all rejected as cycles. The total is 2 plus 3 plus 4 plus 4 plus 5, which is 18 - the same as Prim, as it must be.',
			when: 'Use it on sparse graphs, when the edges are already sorted or arrive sorted, and when you want a minimum spanning forest of a possibly disconnected graph.',
			strengths: [
				'Very simple once union-find is available.',
				'Handles disconnected graphs naturally, producing a forest.',
				'Efficient on sparse graphs and parallelises reasonably.'
			],
			weaknesses: [
				'Needs all edges up front, so it does not suit streaming.',
				'Sorting dominates the running time.',
				'The intermediate result is a forest, not a connected tree, which is less intuitive to watch.'
			],
			mistakes: [
				'Implementing union-find without path compression or union by rank and losing the near-constant bound.',
				'Comparing the two endpoint labels directly instead of their set roots.',
				'Assuming the MST edge set is unique - only the total weight is guaranteed unique when weights repeat.'
			]
		}
	},

	'graph-topological': {
		id: 'graph-topological',
		family: 'graph',
		name: 'Topological sort',
		tagline: 'Order a directed graph so every edge points forwards.',
		pseudocode: [
			'procedure topologicalSort(G)',
			'  compute the in-degree of every node',
			'  ready <- all nodes with in-degree 0',
			'  while ready is not empty',
			'    u <- remove a node from ready',
			'    append u to the order',
			'    for each edge (u, v): decrease in-degree of v; if it reaches 0 then add v to ready',
			'  end while',
			'  if the order is shorter than V then the graph contains a cycle',
			'end procedure'
		],
		complexity: {
			best: 'O(V + E)',
			average: 'O(V + E)',
			worst: 'O(V + E)',
			space: 'O(V)',
			stable: null,
			inPlace: null,
			notes: "Kahn's algorithm. Only defined for directed ACYCLIC graphs; a cycle is detected by the order coming out shorter than the node count, and AlgoLens reports that rather than emitting a partial order as if it were valid."
		},
		js: `function topologicalSort(nodes, edges) {
  const indegree = new Map(nodes.map((n) => [n, 0]));
  const out = new Map(nodes.map((n) => [n, []]));
  for (const { from, to } of edges) {
    indegree.set(to, indegree.get(to) + 1);
    out.get(from).push(to);
  }
  const ready = nodes.filter((n) => indegree.get(n) === 0);
  const order = [];
  while (ready.length) {
    const u = ready.shift();
    order.push(u);
    for (const v of out.get(u)) {
      indegree.set(v, indegree.get(v) - 1);
      if (indegree.get(v) === 0) ready.push(v);
    }
  }
  return order.length === nodes.length ? order : null; // null means there is a cycle
}`,
		py: `from collections import deque

def topological_sort(nodes, edges):
    indegree = {n: 0 for n in nodes}
    out = {n: [] for n in nodes}
    for frm, to in edges:
        indegree[to] += 1
        out[frm].append(to)
    ready = deque(n for n in nodes if indegree[n] == 0)
    order = []
    while ready:
        u = ready.popleft()
        order.append(u)
        for v in out[u]:
            indegree[v] -= 1
            if indegree[v] == 0:
                ready.append(v)
    return order if len(order) == len(nodes) else None  # None means there is a cycle`,
		learn: {
			how: "Kahn's algorithm reads a directed graph as a set of prerequisites. A node with in-degree zero has nothing waiting on it, so it is safe to place next in the order. Removing it decreases the in-degree of everything it points at, which may free further nodes. If the process stalls while nodes remain, those nodes form a cycle - each is waiting on another - and no valid order exists. That failure mode is not an error to hide; it is the algorithm correctly telling you the graph is not acyclic.",
			worked: 'On the sample directed graph A points to B and C, B and C both point to D, and D points to E. Only A has in-degree zero, so it goes first; removing it frees both B and C. Taking B next leaves D still waiting on C, so C goes third, which frees D. D goes fourth and frees E, which goes last. The order A, B, C, D, E has every edge pointing forwards. Add an edge from E back to A and nothing has in-degree zero, so the algorithm reports a cycle.',
			when: 'Use it for build systems, task scheduling with dependencies, course prerequisites, spreadsheet recalculation order and dependency resolution in package managers.',
			strengths: [
				'Linear time.',
				'Detects cycles as a natural by-product.',
				'The ready set can be a priority queue to get a deterministic or lexicographically smallest order.'
			],
			weaknesses: [
				'Only applies to directed acyclic graphs.',
				'The order is usually not unique, which can surprise people comparing outputs.',
				'Gives no information about distances or costs.'
			],
			mistakes: [
				'Running it on an undirected graph, where in-degree is meaningless.',
				'Returning the partial order when a cycle is present instead of reporting the cycle.',
				'Expecting one canonical answer when several valid orders exist.'
			]
		}
	}
};

export function entryFor(family: string, algorithm: string): AlgoEntry | undefined {
	if (family === 'pathfinding') return CATALOG[`path-${algorithm}`];
	if (family === 'graph') return CATALOG[`graph-${algorithm}`];
	return CATALOG[algorithm];
}
