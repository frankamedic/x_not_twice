// ==UserScript==
// @name         X Not Twice
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Hide posts you've already seen on X.com
// @author       Frank Sloan
// @match        https://x.com/*
// @match        https://twitter.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Helper to check if we're on a timeline page
    function isTimelinePage() {
        const path = window.location.pathname;
        return path === '/' || // Home
               path === '/home' || // Home (alternative)
               path.endsWith('/for-you') || // For You page
               path === '/explore'; // Explore page
    }

    // Helper to get tweet ID from article element
    function getTweetId(post) {
        // X.com stores tweet links in format /username/status/[tweet-id]
        const links = post.querySelectorAll('a[href*="/status/"]');
        for (const link of links) {
            const href = link.href;
            // Make sure this is a direct status link
            if (href && href.includes('/status/') && !href.includes('?')) {
                const match = href.match(/\/status\/(\d+)/);
                if (match) return match[1];
            }
        }
        return null;
    }

    let seenPosts = [];
    try {
        seenPosts = JSON.parse(localStorage.getItem('seenPosts') || '[]');
    } catch (e) {
        console.error('Error loading seen posts:', e);
    }

    // Create intersection observer to track when posts become visible
    const postObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const post = entry.target;
                const tweetId = getTweetId(post);
                
                if (tweetId && !seenPosts.includes(tweetId)) {
                    seenPosts.push(tweetId);
                    try {
                        // Limit stored posts to last 100,000
                        if (seenPosts.length > 100000) {
                            seenPosts = seenPosts.slice(-100000);
                        }
                        localStorage.setItem('seenPosts', JSON.stringify(seenPosts));
                    } catch (e) {
                        console.error('Error saving seen posts:', e);
                    }
                }
                
                // Stop observing this post
                postObserver.unobserve(post);
            }
        });
    }, {
        threshold: 0.5 // Post must be 50% visible to be considered "seen"
    });

    function hideSeenPosts() {
        // Only hide posts on timeline pages
        if (!isTimelinePage()) return;

        const posts = document.querySelectorAll('article[data-testid="tweet"]:not([data-processed])');
        
        posts.forEach(function(post) {
            const tweetId = getTweetId(post);
            if (!tweetId) return;

            // Mark as processed to avoid reprocessing
            post.setAttribute('data-processed', 'true');

            if (seenPosts.includes(tweetId)) {
                post.style.display = "none";
            } else {
                // Start observing this post
                postObserver.observe(post);
            }
        });
    }

    // Handle URL changes (X's client-side navigation)
    let lastUrl = location.href;
    new MutationObserver(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            // Clear processed flags when URL changes
            document.querySelectorAll('[data-processed]').forEach(el => {
                el.removeAttribute('data-processed');
            });
        }
        hideSeenPosts();
    }).observe(document, {subtree: true, childList: true});

    // Initial run
    hideSeenPosts();

    // Console utility functions
    function showTrackedPosts() {
        try {
            const posts = JSON.parse(localStorage.getItem('seenPosts') || '[]');
            const storageStr = localStorage.getItem('seenPosts');
            const storageBytes = new Blob([storageStr]).size;
            console.log(`Total tracked posts: ${posts.length}`);
            console.log(`Storage used: ${(storageBytes / 1024).toFixed(2)} KB`);
            console.log('Most recent posts:');
            // Show last 10 posts
            posts.slice(-10).reverse().forEach((id, index) => {
                const url = `https://x.com/i/status/${id}`;
                console.log(`${index + 1}. ${url}`);
            });
        } catch (e) {
            console.error('Error loading tracked posts:', e);
        }
    }

    function clearTrackedPosts() {
        if (confirm('Are you sure you want to clear all tracked posts?')) {
            localStorage.removeItem('seenPosts');
            seenPosts = [];
            console.log('Cleared all tracked posts');
        }
    }

    // Make functions available globally
    window.xNotTwice = {
        show: showTrackedPosts,
        clear: clearTrackedPosts
    };

    console.log('X Not Twice loaded! Type xNotTwice.show() to see tracked posts or xNotTwice.clear() to clear them');
})();

