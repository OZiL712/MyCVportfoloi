document.addEventListener('DOMContentLoaded', () => {
    // 1. Intersection Observer for Fade-in effects
    const faders = document.querySelectorAll('.fade-in');
    
    const appearOptions = {
        threshold: 0.15,
        rootMargin: "0px 0px -50px 0px"
    };

    const appearOnScroll = new IntersectionObserver(function(entries, observer) {
        entries.forEach(entry => {
            if (!entry.isIntersecting) {
                return;
            } else {
                entry.target.classList.add('appear');
                observer.unobserve(entry.target);
            }
        });
    }, appearOptions);

    faders.forEach(fader => {
        appearOnScroll.observe(fader);
    });

    // Theme Toggle Logic
    const themeToggleBtn = document.getElementById('theme-toggle');
    const themeIcon = themeToggleBtn.querySelector('i');
    
    // Check initial state
    if (document.documentElement.getAttribute('data-theme') === 'light') {
        themeIcon.classList.replace('fa-moon', 'fa-sun');
    }

    themeToggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        
        if (newTheme === 'light') {
            themeIcon.classList.replace('fa-moon', 'fa-sun');
        } else {
            themeIcon.classList.replace('fa-sun', 'fa-moon');
        }
    });

    // 2. Mobile Menu Toggle
    const mobileBtn = document.querySelector('.mobile-menu-btn');
    const navLinks = document.querySelector('.nav-links');

    if(mobileBtn) {
        mobileBtn.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            const icon = mobileBtn.querySelector('i');
            if (navLinks.classList.contains('active')) {
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-times');
            } else {
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }
        });
    }

    // Close mobile menu on link click
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            if (navLinks.classList.contains('active')) {
                navLinks.classList.remove('active');
                mobileBtn.querySelector('i').classList.replace('fa-times', 'fa-bars');
            }
        });
    });

    // 3. Fetch GitHub Projects
    const projectsContainer = document.getElementById('github-projects');
    const username = 'OZiL712'; // Specified GitHub Username
    const url = `https://api.github.com/users/${username}/repos?sort=updated&per_page=6`;

    // Map languages to colors for dots
    const langColors = {
        'Dart': '#00B4AB',
        'Java': '#b07219',
        'Python': '#3572A5',
        'JavaScript': '#f1e05a',
        'HTML': '#e34c26',
        'CSS': '#563d7c',
        'C++': '#f34b7d',
        'C': '#555555',
        'Shell': '#89e051',
        'TypeScript': '#3178c6',
        'Flutter': '#02569B' // Not returned by github api natively, but just in case
    };

    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            projectsContainer.innerHTML = ''; // Clear loader
            
            if (data.length === 0) {
                projectsContainer.innerHTML = '<p class="content-desc">No public repositories found.</p>';
                return;
            }

            // Exclude profile readmes or specific forks if desired, but we'll show recent ones
            data.forEach((repo, index) => {
                // Ignore profile repository if it is same as username
                if(repo.name.toLowerCase() === username.toLowerCase()) return;

                const lang = repo.language || 'Code';
                const langColor = langColors[lang] || '#3b82f6';
                const delayStr = `style="animation-delay: ${index * 0.1}s"`;

                // Translate descriptions if they are not purely technical or english only, 
                // but usually user might want JS translation "yes" for desc, and "no" for names/tech.
                const projectHTML = `
                    <div class="project-card glass-card fade-in appear" ${delayStr}>
                        <h3 class="project-title" translate="no">
                            <i class="far fa-folder-open" style="color: var(--accent-blue)"></i>
                            ${repo.name.replace(/-/g, ' ')}
                        </h3>
                        <p class="project-desc" translate="yes">
                            ${repo.description ? repo.description : 'A structural component or application repository.'}
                        </p>
                        <div class="project-footer">
                            <div class="project-lang" translate="no">
                                <span class="lang-dot" style="background-color: ${langColor}"></span> 
                                ${lang}
                            </div>
                            <a href="${repo.html_url}" target="_blank" class="project-link" aria-label="View Source">
                                <i class="fab fa-github"></i>
                            </a>
                        </div>
                    </div>
                `;
                projectsContainer.innerHTML += projectHTML;
            });
        })
        .catch(error => {
            console.error('Error fetching repositories:', error);
            projectsContainer.innerHTML = `
                <div class="glass-card" style="grid-column: 1 / -1; text-align: center;">
                    <p style="color: var(--text-secondary);">Unable to load projects at this time. Please visit my <a href="https://github.com/${username}" target="_blank" translate="no" style="color: var(--accent-blue);">GitHub profile</a> directly.</p>
                </div>
            `;
        });
});
