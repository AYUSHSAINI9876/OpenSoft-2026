import React from 'react';


const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  const footerLinks = [
    {
      title: 'Platform',
      links: ['Markets', 'Help Center', 'API Documentation', 'Media Kit'],
    },
    {
      title: 'Company',
      links: ['Investor Relations', 'Careers', 'Terms of Service', 'Privacy Policy'],
    },
    {
      title: 'Legal',
      links: ['Legal Notices', 'Cookie Preferences', 'System Status', 'Contact Us'],
    },
  ];

  const socialIcons = [
    {
      name: 'Facebook',
      path: 'M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z',
    },
    {
      name: 'Instagram',
      path: 'M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z M17.5 6.5h.01',
      extra: <rect x="2" y="2" width="20" height="20" rx="5" ry="5" fill="none" stroke="currentColor" strokeWidth="2" />,
    },
    {
      name: 'Twitter',
      path: 'M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z',
    },
    {
      name: 'Youtube',
      path: 'M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33 2.78 2.78 0 0 0 1.94 2C5.12 20 12 20 12 20s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.33 29 29 0 0 0-.46-5.33z',
      extra: <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" fill="currentColor" />,
    },
  ];

  return (
    <footer className="border-t border-[#1E222D] bg-[#000000] px-4 py-16 md:px-8">
      <div className="mx-auto max-w-[1100px]">
        {/* Social Icons */}
        <div className="flex gap-6 mb-10">
          {socialIcons.map((icon) => (
            <a key={icon.name} href="#" className="text-white hover:text-white transition-colors duration-200">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {icon.extra}
                <path d={icon.path} />
              </svg>
            </a>
          ))}
        </div>


        {/* Links Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-8 mb-12">
          {footerLinks.map((section, idx) => (
            <div key={idx} className="flex flex-col gap-4">
              {section.links.map((link, linkIdx) => (
                <a
                  key={linkIdx}
                  href="#"
                  className="text-[13px] text-slate-500 hover:underline decoration-slate-500 transition-all"
                >
                  {link}
                </a>
              ))}
            </div>
          ))}
        </div>

        {/* Copyright */}
        <div className="text-[11px] text-slate-500 font-mono">
          © 1997-{currentYear} Synthbull, Inc.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
